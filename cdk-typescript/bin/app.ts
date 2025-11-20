#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlueGreenDeploymentStack } from '../lib/bluegreen-deployment-stack';

/**
 * Main CDK Application for Blue-Green Deployment
 * 
 * This application creates a complete CI/CD pipeline for blue-green deployment
 * to AWS Elastic Beanstalk using AWS CodePipeline, CodeBuild, and Lambda functions.
 */

const app = new cdk.App();

// Get configuration from context or use defaults
const config = {
  // AWS Elastic Beanstalk configuration
  beanstalkSourceStageS3BucketName: app.node.tryGetContext('beanstalkSourceStageS3BucketName') || '',
  beanstalkSourceStageS3BucketKey: app.node.tryGetContext('beanstalkSourceStageS3BucketKey') || 'app-source.zip',
  existingBlueEnvironmentName: app.node.tryGetContext('existingBlueEnvironmentName') || '',
  existingBeanstalkApplicationName: app.node.tryGetContext('existingBeanstalkApplicationName') || '',
  greenEnvironmentName: app.node.tryGetContext('greenEnvironmentName') || 'GreenEnvironment',
  
  // AWS CodePipeline parameters
  administratorEmail: app.node.tryGetContext('administratorEmail') || '',
  nameofthePipeline: app.node.tryGetContext('nameofthePipeline') || 'BlueGreenCICDPipeline',
  
  // Git2S3 integration parameters
  gitToS3integration: app.node.tryGetContext('gitToS3integration') === 'true',
  customDomainName: app.node.tryGetContext('customDomainName') || '',
  apiSecret: app.node.tryGetContext('apiSecret') || '',
  allowedIps: app.node.tryGetContext('allowedIps') || '131.103.20.160/27,165.254.145.0/26,104.192.143.0/24',
  
  // Quick Start configuration
  qss3BucketName: app.node.tryGetContext('qss3BucketName') || 'aws-quickstart',
  qss3BucketRegion: app.node.tryGetContext('qss3BucketRegion') || 'us-east-1',
  qss3KeyPrefix: app.node.tryGetContext('qss3KeyPrefix') || 'quickstart-codepipeline-bluegreen-deployment/',
  
  // Environment configuration
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }
};

// Validate required parameters
if (!config.administratorEmail) {
  throw new Error('administratorEmail is required. Please provide it via context: --context administratorEmail=your@email.com');
}

if (!config.beanstalkSourceStageS3BucketKey) {
  throw new Error('beanstalkSourceStageS3BucketKey is required. Please provide it via context.');
}

// Create the main stack
new BlueGreenDeploymentStack(app, 'BlueGreenDeploymentStack', {
  ...config,
  description: 'CICD Pipeline setup for cost efficient Elastic Beanstalk Blue-Green deployment (CDK version)',
  tags: {
    Application: 'BlueGreenDeployment',
    ManagedBy: 'CDK',
  }
});

app.synth();
