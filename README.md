# CDK Bundle Analyzer

A library that delivers tools to analyze the bundle size of TypeScript/JavaScript CDK functions.

## Prerequisites 📓

1. Use the [`NodejsFunction` construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html) to define functions
   - If using a custom construct that extends the `NodejsFunction` construct, refer to the [Custom `NodejsFunction` construct section](#custom-nodejsfunction-construct-%EF%B8%8F)
2. Have [local bundling](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html#local-bundling) enabled. Basically, this means that the bundling of the lambdas is done on the machine, not inside a docker container. To achieve that, `esbuild` must be installed in the project. Follow the link above for more details.

## Usage 📦

Install with

```bash
pnpm add -D cdk-bundle-analyzer
```

Add the following [CDK aspect](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html) after the CDK app definition:

```ts
import { NodeJsFunctionBundleAnalyzerAspect } from 'cdk-bundle-analyzer';

const app = new App();

// ...

Aspects.of(app).add(new NodeJsFunctionBundleAnalyzerAspect());
```

Add the `metafile` option to the `NodejsFunction` to analyze:

```ts
new NodejsFunction(this, 'MyFunction', {
  entry: 'src/index.ts',
  bundling: {
    // ...
    metafile: true,
  }
});
```

Run the following command to analyze the bundle:

```bash
cdk synth --quiet -c analyze=Health
```

A browser window will open with the bundle size analysis 🎉

## Options 🛠

For easier DX, the options must be passed as [CDK context variables](https://docs.aws.amazon.com/cdk/v2/guide/context.html), directly when running the `cdk synth` command.

The following options are available:

### `analyze`

The name of the function to analyze. If not specified, no function will be analyzed.

Example:

```bash
cdk synth --quiet -c analyze=Health
```

### `template`

The bundle template to use. Should be one of `sunburst`, `treemap`, `network`. Defaults to `treemap`.

Example:

```bash
cdk synth --quiet -c analyze=Health -c template=sunburst
```

## Custom `NodejsFunction` construct 🏗️

If using a custom construct that extends the `NodejsFunction` construct, simply pass the custom construct that extends the `NodejsFunction` construct to the `NodeJsFunctionBundleAnalyzerAspect` constructor.

For example:

```ts
import { NodeJsFunctionBundleAnalyzerAspect } from 'cdk-bundle-analyzer';

const app = new App();

// ...

class MyCustomNodejsFunction extends NodejsFunction {
  // ...
}

// ...

Aspects.of(app).add(
  new NodeJsFunctionBundleAnalyzerAspect({
    customFunctionConstruct: MyCustomNodejsFunction,
  }),
);
```

## Remarks 📝

- The `NodeJsFunctionBundleAnalyzerAspect` will have no effect on the CDK app whatsoever. It will not change the behavior of the CDK app in any way. Moreover, the side-effect that generates the bundle analysis will only be executed if the `analyze` context variable is specified. Thus it is safe to add the aspect to the CDK app and commit it to the repository.
- The `metafile` option is required to be set to `true` in the `NodejsFunction` construct. This is because the aspect needs to read the `esbuild` metafile to analyze the bundle. If committed, this means that the resulting metafile will be included in the lambda's deployment package. Its size is approximately the same as the bundle size. It is up to the user to decide if this is acceptable or not to commit.

## Using the Serverless Framework instead of the CDK? 🤔

No worries! Check out my plugin [serverless-analyze-bundle-plugin](https://github.com/adriencaccia/serverless-analyze-bundle-plugin) that does the same thing for the Serverless Framework 🚀
