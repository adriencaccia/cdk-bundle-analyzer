import { IAspect } from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IConstruct } from 'constructs';
import { Metadata, TemplateType, visualizer } from 'esbuild-visualizer';
import { promises as fs } from 'fs';
import open from 'open';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

/**
 * Return `true` if `node` is a `NodejsFunction` instance.
 *
 * We cannot use `instanceof` because the `NodejsFunction` class will be copied in the imported code.
 *
 * See https://stackoverflow.com/a/63937850
 */
function isNodejsFunction(node: IConstruct): node is NodejsFunction {
  return node.constructor.name === NodejsFunction.name;
}

class NodeJsFunctionBundleAnalyzerAspect implements IAspect {
  async visit(node: IConstruct): Promise<void> {
    const functionToAnalyze = node.node.tryGetContext('analyze') as string | undefined;
    if (functionToAnalyze === undefined) {
      return;
    }
    const template = node.node.tryGetContext('template') as TemplateType | undefined;

    if (template !== undefined && !['sunburst', 'treemap', 'network'].includes(template)) {
      throw new Error(
        `🤯 Analyze failed: template ${template} is not supported. Should be one of 'sunburst', 'treemap', 'network'`,
      );
    }

    if (isNodejsFunction(node)) {
      const functionName = node
        .toString()
        .replace(node.stack.stackName, '')
        .replace('Lambda', '')
        .replace(/\//g, '');

      if (functionName !== functionToAnalyze) {
        return;
      }

      console.log(`\n⏳ Analyzing function ${functionName}`);

      const assetPath = (node.node.defaultChild as CfnFunction).cfnOptions.metadata?.[
        'aws:asset:path'
      ] as string;
      const metafilePath = join('cdk.out', assetPath, 'index.meta.json');

      let textContent: string;
      try {
        textContent = await fs.readFile(metafilePath, {
          encoding: 'utf-8',
        });
      } catch (e) {
        console.error(
          `\n🤯 Analyze failed: metafile ${metafilePath} not found. Did you set metafile: true in the bundling options of the ${functionName} NodejsFunction construct?\n`,
        );

        throw new Error('Analyze failed');
      }

      const jsonContent = JSON.parse(textContent) as Metadata;

      const fileContent = await visualizer(jsonContent, {
        title: `${functionName} function bundle visualizer `,
        template: template ?? 'treemap',
      });

      const TMP_FOLDER = join(tmpdir(), 'cdk-bundle-analyzer');
      const TEMP_DIR_LOCATION = join(TMP_FOLDER, new Date().getTime().toString());

      const filename = `${TEMP_DIR_LOCATION}/${functionName}.html`;

      await fs.mkdir(dirname(filename), { recursive: true });
      await fs.writeFile(filename, fileContent);

      await open(filename);
    }
  }
}

export default NodeJsFunctionBundleAnalyzerAspect;
