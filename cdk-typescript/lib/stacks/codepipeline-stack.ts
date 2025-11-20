import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CodePipelineStackProps {
  administratorEmail: string;
  nameofthePipeline: string;
  qss3KeyPrefix: string;
  lambdaZipsBucket: s3.IBucket;
  blueEnvironmentName: string;
  greenEnvironmentName: string;
  beanstalkApplicationName: string;
  beanstalkSourceStageBucketKey: string;
  beanstalkSourceStageBucket: string;
  codePipelineArtifactStore: s3.IBucket;
}

/**
 * Stack that creates the CodePipeline for Blue-Green Deployment
 * 
 * Pipeline stages:
 * 1. Source - Pull application code and Lambda functions
 * 2. Lambda - Create green environment (clone of blue)
 * 3. Manual Approval - Wait for approval before swapping
 * 4. Swap URL - Route traffic from blue to green
 * 5. Deploy - Deploy new version to blue environment
 * 6. Test - Test the blue environment
 * 7. Cleanup - Swap traffic back to blue and terminate green
 */
export class CodePipelineStack extends cdk.NestedStack {
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
    super(scope, id);

    // Create SNS topic for manual approval notifications
    const approvalTopic = new sns.Topic(this, 'ManualApprovalSNSTopic', {
      displayName: 'Blue-Green Deployment Manual Approval',
    });

    approvalTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.administratorEmail)
    );

    // Create IAM role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-AWSElasticBeanstalk'),
      ],
    });

    // Add CodePipeline job result permissions
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'codepipeline:PutJobSuccessResult',
        'codepipeline:PutJobFailureResult',
      ],
      resources: ['*'],
    }));

    // Create Lambda function for creating green environment
    const createCloneLambda = new lambda.Function(this, 'CreateCloneLambdaFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromBucket(
        props.lambdaZipsBucket,
        `${props.qss3KeyPrefix}functions/packages/CreateEnvironment/creategreenenv.zip`
      ),
    });

    // Create Lambda function for terminating green environment
    const terminateGreenLambda = new lambda.Function(this, 'TerminateGreenEnvLambdaFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromBucket(
        props.lambdaZipsBucket,
        `${props.qss3KeyPrefix}functions/packages/TerminateandReSwap/terminategreenenv.zip`
      ),
    });

    // Create IAM role for CodeBuild
    const buildServiceRole = new iam.Role(this, 'BuildServiceRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      path: '/',
    });

    buildServiceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [`arn:${cdk.Aws.PARTITION}:logs:*:*:log-group:*:*`],
    }));

    buildServiceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3GetObjectPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListObjects',
        's3:GetObjectVersion',
      ],
      resources: [`arn:${cdk.Aws.PARTITION}:s3:::*`],
    }));

    buildServiceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3PutObjectPolicy',
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`arn:${cdk.Aws.PARTITION}:s3:::*`],
    }));

    buildServiceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EBAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticbeanstalk:SwapEnvironmentCNAMEs',
        'elasticbeanstalk:DescribeEnvironmentManagedActionHistory',
        'elasticbeanstalk:DescribeConfigurationSettings',
        'elasticbeanstalk:DescribeEvents',
        'elasticbeanstalk:DescribeEnvironments',
        'elasticbeanstalk:DescribeEnvironmentHealth',
        'elasticbeanstalk:DescribeAccountAttributes',
        'elasticbeanstalk:DescribeEnvironmentManagedActions',
        'elasticbeanstalk:DescribeApplicationVersion',
        'elasticbeanstalk:DescribePlatformVersion',
        'elasticbeanstalk:DescribeInstancesHealth',
        'elasticbeanstalk:DescribeConfigurationOptions',
        'elasticbeanstalk:DescribeEnvironmentResources',
        'elasticbeanstalk:DescribeApplications',
        'cloudformation:GetTemplate',
      ],
      resources: [`arn:${cdk.Aws.PARTITION}:elasticbeanstalk:::*`],
    }));

    // Create CodeBuild project for URL swap
    const swapUrlProject = new codebuild.Project(this, 'CodeBuildSwapServer', {
      projectName: 'CICDurlSwap',
      description: 'CodeBuild Server to swap the urls between the Blue and Green Environments',
      role: buildServiceRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          BlueEnvName: { value: props.blueEnvironmentName },
          GreenEnvName: { value: props.greenEnvironmentName },
          BlueCNAMEConfigBucket: { value: props.lambdaZipsBucket.bucketName },
          BlueCNAMEConfigFile: { value: 'bluecnameconfig.json' },
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      timeout: cdk.Duration.minutes(60),
    });

    // Create CodeBuild project for testing
    const testBlueProject = new codebuild.Project(this, 'CodeBuildTestServer', {
      projectName: 'CICDBlueDeploymentTest',
      description: 'CodeBuild Test Server for the Blue Environment after new deployment',
      role: buildServiceRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          BlueEnvName: { value: props.blueEnvironmentName },
          GreenEnvName: { value: props.greenEnvironmentName },
          BlueCNAMEConfigFile: { value: 'bluecnameconfig.json' },
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      timeout: cdk.Duration.minutes(60),
    });

    // Create IAM role for CodePipeline
    const pipelineRole = new iam.Role(this, 'PipelineServiceRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      path: '/',
    });

    pipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:GetObjectVersion',
        's3:GetBucketVersioning',
        's3:PutObject',
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:s3:::codepipeline*`,
        `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk*`,
      ],
    }));

    pipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticbeanstalk:*',
        'ec2:*',
        'elasticloadbalancing:*',
        'autoscaling:*',
        'cloudformation:*',
        'cloudwatch:*',
        'sns:*',
        'rds:*',
        'sqs:*',
        'ecs:*',
        'iam:PassRole',
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:s3:::codepipeline*`,
        `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk*`,
      ],
    }));

    pipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
        'lambda:ListFunctions',
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:s3:::codepipeline*`,
        `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk*`,
      ],
    }));

    pipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'codebuild:BatchGetBuilds',
        'codebuild:StartBuild',
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:s3:::codepipeline*`,
        `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk*`,
      ],
    }));

    // Get source bucket
    const sourceBucket = s3.Bucket.fromBucketName(
      this,
      'SourceBucket',
      props.beanstalkSourceStageBucket
    );

    // Define artifacts
    const sourceArtifact = new codepipeline.Artifact('ElasticBeanstalkPackage');
    const urlSwapArtifact = new codepipeline.Artifact('UrlSwapPackage');
    const testArtifact = new codepipeline.Artifact('BlueEnvTestPackage');

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'BlueGreenCICDPipeline', {
      pipelineName: props.nameofthePipeline,
      artifactBucket: props.codePipelineArtifactStore,
      role: pipelineRole,
      stages: [
        {
          stageName: 'SourceForElasticBeanstalk',
          actions: [
            new codepipeline_actions.S3SourceAction({
              actionName: 'SourceForElasticBeanstalk',
              bucket: sourceBucket,
              bucketKey: props.beanstalkSourceStageBucketKey,
              output: sourceArtifact,
              trigger: codepipeline_actions.S3Trigger.POLL,
            }),
            new codepipeline_actions.S3SourceAction({
              actionName: 'SourceForCodeBuildStage',
              bucket: props.lambdaZipsBucket,
              bucketKey: `${props.qss3KeyPrefix}functions/packages/SwapEnvironments/swapenvironments.zip`,
              output: urlSwapArtifact,
              trigger: codepipeline_actions.S3Trigger.NONE,
              runOrder: 2,
            }),
            new codepipeline_actions.S3SourceAction({
              actionName: 'SourceForCodeBuildTestStage',
              bucket: props.lambdaZipsBucket,
              bucketKey: `${props.qss3KeyPrefix}functions/packages/TestBlueEnvironment/testBlueenvironment.zip`,
              output: testArtifact,
              trigger: codepipeline_actions.S3Trigger.NONE,
              runOrder: 2,
            }),
          ],
        },
        {
          stageName: 'Lambda',
          actions: [
            new codepipeline_actions.LambdaInvokeAction({
              actionName: 'LambdaFunctionForNewEnvCreation',
              lambda: createCloneLambda,
              userParameters: {
                BlueEnvName: props.blueEnvironmentName,
                GreenEnvName: props.greenEnvironmentName,
                BlueCNAMEConfigBucket: props.lambdaZipsBucket.bucketName,
                BeanstalkAppName: props.beanstalkApplicationName,
                CreateConfigTempName: 'BlueEnvConfig',
                BlueCNAMEConfigFile: 'bluecnameconfig.json',
              },
            }),
          ],
        },
        {
          stageName: 'ManualApprovalForUrlSwap',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'manualapp',
              notificationTopic: approvalTopic,
              additionalInformation: 'Please approve to swap URLs from Blue to Green environment',
            }),
          ],
        },
        {
          stageName: 'SwapUrlCodeBuild',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'SwapUrlBeanstalk',
              project: swapUrlProject,
              input: urlSwapArtifact,
            }),
          ],
        },
        {
          stageName: 'DeploytoBlueEnvironment',
          actions: [
            new codepipeline_actions.ElasticBeanstalkDeployAction({
              actionName: 'BeanstalkBlueDeploy',
              applicationName: props.beanstalkApplicationName,
              environmentName: props.blueEnvironmentName,
              input: sourceArtifact,
            }),
          ],
        },
        {
          stageName: 'BlueEnvTestCodeBuild',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BlueEnvTestBeanstalk',
              project: testBlueProject,
              input: testArtifact,
            }),
          ],
        },
        {
          stageName: 'ReswapAndCleanUpGreenEnv',
          actions: [
            new codepipeline_actions.LambdaInvokeAction({
              actionName: 'ReswapAndCleanUpGreenEnv',
              lambda: terminateGreenLambda,
              userParameters: {
                BlueEnvName: props.blueEnvironmentName,
                GreenEnvName: props.greenEnvironmentName,
                BlueCNAMEConfigBucket: props.lambdaZipsBucket.bucketName,
                BeanstalkAppName: props.beanstalkApplicationName,
                CreateConfigTempName: 'BlueEnvConfig',
                BlueCNAMEConfigFile: 'bluecnameconfig.json',
              },
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineNameOutput', {
      description: 'Name of the CodePipeline',
      value: this.pipeline.pipelineName,
    });

    new cdk.CfnOutput(this, 'PipelineArnOutput', {
      description: 'ARN of the CodePipeline',
      value: this.pipeline.pipelineArn,
    });
  }
}
