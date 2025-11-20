import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaAssetsStack } from './stacks/lambda-assets-stack';
import { ElasticBeanstalkStack } from './stacks/elasticbeanstalk-stack';
import { CodePipelineStack } from './stacks/codepipeline-stack';

/**
 * Configuration interface for the Blue-Green Deployment Stack
 */
export interface BlueGreenDeploymentConfig {
  // Elastic Beanstalk configuration
  beanstalkSourceStageS3BucketName: string;
  beanstalkSourceStageS3BucketKey: string;
  existingBlueEnvironmentName: string;
  existingBeanstalkApplicationName: string;
  greenEnvironmentName: string;
  
  // CodePipeline parameters
  administratorEmail: string;
  nameofthePipeline: string;
  
  // Git2S3 integration (optional)
  gitToS3integration: boolean;
  customDomainName: string;
  apiSecret: string;
  allowedIps: string;
  
  // Quick Start configuration
  qss3BucketName: string;
  qss3BucketRegion: string;
  qss3KeyPrefix: string;
  
  // Environment
  env?: cdk.Environment;
}

/**
 * Main Stack for Blue-Green Deployment
 * 
 * This stack orchestrates the creation of:
 * 1. Lambda assets and S3 buckets for pipeline artifacts
 * 2. Optional Elastic Beanstalk sample application
 * 3. CodePipeline with blue-green deployment stages
 */
export class BlueGreenDeploymentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: BlueGreenDeploymentConfig & cdk.StackProps) {
    super(scope, id, config);

    // Determine if we need to create new Beanstalk resources
    const createNewBeanstalkEnv = !config.existingBlueEnvironmentName;
    const createNewBeanstalkApp = !config.existingBeanstalkApplicationName;
    const createBeanstalkStack = createNewBeanstalkEnv || createNewBeanstalkApp;
    
    // Determine if we need to create bucket for Beanstalk source
    const createBucketForBeanstalkSource = 
      !config.beanstalkSourceStageS3BucketName && !config.gitToS3integration;

    // 1. Create Lambda Assets Stack
    // This stack creates S3 buckets and copies Lambda function code
    const lambdaAssetsStack = new LambdaAssetsStack(this, 'LambdaAssets', {
      qss3BucketName: config.qss3BucketName,
      qss3BucketRegion: config.qss3BucketRegion,
      qss3KeyPrefix: config.qss3KeyPrefix,
      createBeanstalkSourceBucket: createBucketForBeanstalkSource,
      gitToS3integration: config.gitToS3integration,
    });

    // Determine the Beanstalk source bucket
    let beanstalkSourceBucket: string;
    if (config.gitToS3integration) {
      // If Git2S3 integration is enabled, would use the Git2S3 output bucket
      // For now, create a bucket as Git2S3 integration is complex
      beanstalkSourceBucket = lambdaAssetsStack.beanstalkSourceBucket?.bucketName || '';
    } else if (createBucketForBeanstalkSource) {
      beanstalkSourceBucket = lambdaAssetsStack.beanstalkSourceBucket!.bucketName;
    } else {
      beanstalkSourceBucket = config.beanstalkSourceStageS3BucketName;
    }

    // 2. Create Elastic Beanstalk Stack (if needed)
    let beanstalkStack: ElasticBeanstalkStack | undefined;
    let blueEnvironmentName: string;
    let beanstalkApplicationName: string;

    if (createBeanstalkStack) {
      beanstalkStack = new ElasticBeanstalkStack(this, 'BeanstalkSample', {
        existingBlueEnvironmentName: config.existingBlueEnvironmentName,
        existingBeanstalkApplicationName: config.existingBeanstalkApplicationName,
        greenEnvironmentName: config.greenEnvironmentName,
        newBlueEnvironmentName: 'BlueEnvironment',
        newBeanstalkApplicationName: 'BlueGreenBeanstalkApplication',
        solutionStackForNewBeanstalkEnv: '64bit Amazon Linux 2 v3.3.1 running PHP 7.4',
        appPackageS3Bucket: 'elasticbeanstalk-samples',
        appPackageS3key: 'php-sample.zip',
      });

      blueEnvironmentName = beanstalkStack.environmentName || config.existingBlueEnvironmentName;
      beanstalkApplicationName = beanstalkStack.applicationName || config.existingBeanstalkApplicationName;
    } else {
      blueEnvironmentName = config.existingBlueEnvironmentName;
      beanstalkApplicationName = config.existingBeanstalkApplicationName;
    }

    // 3. Create CodePipeline Stack
    const codePipelineStack = new CodePipelineStack(this, 'CodePipeline', {
      administratorEmail: config.administratorEmail,
      nameofthePipeline: config.nameofthePipeline,
      qss3KeyPrefix: config.qss3KeyPrefix,
      lambdaZipsBucket: lambdaAssetsStack.lambdaZipsBucket,
      blueEnvironmentName: blueEnvironmentName,
      greenEnvironmentName: config.greenEnvironmentName,
      beanstalkApplicationName: beanstalkApplicationName,
      beanstalkSourceStageBucketKey: config.beanstalkSourceStageS3BucketKey,
      beanstalkSourceStageBucket: beanstalkSourceBucket,
      codePipelineArtifactStore: lambdaAssetsStack.artifactBucket,
    });

    // Add dependencies
    if (beanstalkStack) {
      codePipelineStack.addDependency(beanstalkStack);
    }
    codePipelineStack.addDependency(lambdaAssetsStack);

    // Outputs
    new cdk.CfnOutput(this, 'CodePipelineName', {
      description: 'Name of the Pipeline',
      value: config.nameofthePipeline,
    });

    new cdk.CfnOutput(this, 'BlueEnvironmentName', {
      description: 'Name of the Blue Environment',
      value: blueEnvironmentName,
    });

    new cdk.CfnOutput(this, 'GreenEnvironmentName', {
      description: 'Name of the Green Environment',
      value: config.greenEnvironmentName,
    });

    new cdk.CfnOutput(this, 'BeanstalkSourceBucketName', {
      description: 'Name of the bucket where the application code should be uploaded for the Elastic Beanstalk application',
      value: beanstalkSourceBucket,
    });

    if (beanstalkStack && createNewBeanstalkEnv && beanstalkStack.environmentEndpointUrl) {
      new cdk.CfnOutput(this, 'NewBeanstalkEnvEndPointUrl', {
        description: 'New Beanstalk Environment Endpoint URL',
        value: `http://${beanstalkStack.environmentEndpointUrl}`,
      });
    }
  }
}
