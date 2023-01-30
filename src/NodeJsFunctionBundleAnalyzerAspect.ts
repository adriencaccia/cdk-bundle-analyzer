import { Annotations, IAspect } from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IConstruct } from 'constructs';
import { Metadata, TemplateType, visualizer } from 'esbuild-visualizer';
import { existsSync, promises as fs } from 'fs';
import open from 'open';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

/**
 * Return `true` if `node` is a `NodejsFunction` instance or a custom function construct instance.
 *
 * We cannot use `instanceof` because the `NodejsFunction` class will be copied in the imported code.
 *
 * See https://stackoverflow.com/a/63937850
 */
function isNodejsFunction(
  node: IConstruct,
  customFunctionConstructName?: string,
): node is NodejsFunction {
  return (
    node.constructor.name === NodejsFunction.name ||
    node.constructor.name === customFunctionConstructName
  );
}

interface NodeJsFunctionBundleAnalyzerAspectProps {
  customFunctionConstruct?: typeof NodejsFunction;
}

class NodeJsFunctionBundleAnalyzerAspect implements IAspect {
  private customFunctionConstructName: string | undefined;

  constructor({ customFunctionConstruct }: NodeJsFunctionBundleAnalyzerAspectProps) {
    this.customFunctionConstructName = customFunctionConstruct?.prototype.constructor.name;
  }

  async visit(node: IConstruct): Promise<void> {
    const functionToAnalyze = node.node.tryGetContext('analyze') as string | undefined;
    if (functionToAnalyze === undefined) {
      return;
    }
    const template = node.node.tryGetContext('template') as TemplateType | undefined;

    if (isNodejsFunction(node, this.customFunctionConstructName)) {
      if (!node.toString().includes(functionToAnalyze)) {
        return;
      }

      if (template !== undefined && !['sunburst', 'treemap', 'network'].includes(template)) {
        Annotations.of(node).addError(
          `🤯 Analyze failed: template ${template} is not supported. Should be one of 'sunburst', 'treemap', 'network'`,
        );

        return;
      }

      Annotations.of(node).addInfo('⏳ Analyzing function');

      const assetPath = (node.node.defaultChild as CfnFunction).cfnOptions.metadata?.[
        'aws:asset:path'
      ] as string;
      const metafilePath = join('cdk.out', assetPath, 'index.meta.json');

      const metafileExists = existsSync(metafilePath);
      if (!metafileExists) {
        Annotations.of(node).addError(
          `🤯 Analyze failed: metafile ${metafilePath} not found. Make sure metafile: true is specified in the bundling options?`,
        );

        return;
      }
      const textContent = await fs.readFile(metafilePath, { encoding: 'utf-8' });

      const jsonContent = JSON.parse(textContent) as Metadata;

      const fileContent = await visualizer(jsonContent, {
        title: `${functionToAnalyze} function bundle visualizer `,
        template: template ?? 'treemap',
      });

      const TMP_FOLDER = join(tmpdir(), 'cdk-bundle-analyzer');
      const TEMP_DIR_LOCATION = join(TMP_FOLDER, new Date().getTime().toString());

      const filename = `${TEMP_DIR_LOCATION}/${functionToAnalyze}.html`;

      await fs.mkdir(dirname(filename), { recursive: true });
      await fs.writeFile(filename, fileContent);

      await open(filename);
    }
  }
}

export default NodeJsFunctionBundleAnalyzerAspect;
