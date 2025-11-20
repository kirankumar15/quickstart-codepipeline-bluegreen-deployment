import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface LambdaAssetsStackProps {
  qss3BucketName: string;
  qss3BucketRegion: string;
  qss3KeyPrefix: string;
  createBeanstalkSourceBucket: boolean;
  gitToS3integration: boolean;
}

/**
 * Stack that manages Lambda assets and S3 buckets
 * 
 * Creates:
 * - S3 bucket for CodePipeline artifacts
 * - S3 bucket for Lambda function code
 * - Optional S3 bucket for Beanstalk source
 * - Custom resource to copy Lambda code from Quick Start bucket
 */
export class LambdaAssetsStack extends cdk.NestedStack {
  public readonly artifactBucket: s3.IBucket;
  public readonly lambdaZipsBucket: s3.IBucket;
  public readonly beanstalkSourceBucket?: s3.IBucket;

  constructor(scope: Construct, id: string, props: LambdaAssetsStackProps) {
    super(scope, id);

    // Create CodePipeline artifact store bucket
    this.artifactBucket = new s3.Bucket(this, 'CodePipelineArtifactStore', {
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Create Lambda zips bucket
    this.lambdaZipsBucket = new s3.Bucket(this, 'LambdaZipsBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Create Beanstalk source bucket if needed
    if (props.createBeanstalkSourceBucket) {
      this.beanstalkSourceBucket = new s3.Bucket(this, 'BeanstalkSourceBucket', {
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
      });
    }

    // Create IAM role for copy Lambda function
    const copyRole = new iam.Role(this, 'CopyRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Determine source bucket name based on region
    const usingDefaultBucket = props.qss3BucketName === 'aws-quickstart';
    const sourceBucketName = usingDefaultBucket 
      ? `${props.qss3BucketName}-${cdk.Aws.REGION}`
      : props.qss3BucketName;

    // Add permissions to read from source bucket
    copyRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [`arn:${cdk.Aws.PARTITION}:s3:::${sourceBucketName}/${props.qss3KeyPrefix}*`],
    }));

    // Add permissions to write to destination bucket
    copyRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:DeleteObject'],
      resources: [`${this.lambdaZipsBucket.bucketArn}/*`],
    }));

    // Create Lambda function to copy files from Quick Start bucket
    const copyZipsFunction = new lambda.Function(this, 'CopyZipsFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(4),
      role: copyRole,
      code: lambda.Code.fromInline(`
import json
import logging
import threading
import boto3
import cfnresponse

def copy_objects(source_bucket, dest_bucket, prefix, objects):
    s3 = boto3.client('s3')
    for o in objects:
        key = prefix + o
        copy_source = {
            'Bucket': source_bucket,
            'Key': key
        }
        print(f'Copying {key} from {source_bucket} to {dest_bucket}')
        s3.copy_object(CopySource=copy_source, Bucket=dest_bucket, Key=key)

def delete_objects(bucket, prefix, objects):
    s3 = boto3.client('s3')
    objects_to_delete = {'Objects': [{'Key': prefix + o} for o in objects]}
    s3.delete_objects(Bucket=bucket, Delete=objects_to_delete)

def timeout(event, context):
    logging.error('Execution is about to time out, sending failure response to CloudFormation')
    cfnresponse.send(event, context, cfnresponse.FAILED, {}, None)

def handler(event, context):
    timer = threading.Timer((context.get_remaining_time_in_millis() / 1000.00) - 0.5, timeout, args=[event, context])
    timer.start()
    print('Received event: %s' % json.dumps(event))
    status = cfnresponse.SUCCESS
    try:
        source_bucket = event['ResourceProperties']['SourceBucket']
        dest_bucket = event['ResourceProperties']['DestBucket']
        prefix = event['ResourceProperties']['Prefix']
        objects = event['ResourceProperties']['Objects']
        if event['RequestType'] == 'Delete':
            delete_objects(dest_bucket, prefix, objects)
        else:
            copy_objects(source_bucket, dest_bucket, prefix, objects)
    except Exception as e:
        logging.error('Exception: %s' % e, exc_info=True)
        status = cfnresponse.FAILED
    finally:
        timer.cancel()
        cfnresponse.send(event, context, status, {}, None)
`),
    });

    // Lambda functions to copy
    const lambdaPackages = [
      'functions/packages/CreateEnvironment/creategreenenv.zip',
      'functions/packages/SwapEnvironments/swapenvironments.zip',
      'functions/packages/TestBlueEnvironment/testBlueenvironment.zip',
      'functions/packages/TerminateandReSwap/terminategreenenv.zip',
    ];

    // Create custom resource to trigger the copy
    new cdk.CustomResource(this, 'CopyZips', {
      serviceToken: copyZipsFunction.functionArn,
      properties: {
        SourceBucket: sourceBucketName,
        DestBucket: this.lambdaZipsBucket.bucketName,
        Prefix: props.qss3KeyPrefix,
        Objects: lambdaPackages,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'CodePipelineArtifactStoreOutput', {
      description: 'S3 Bucket for the CodePipeline Artifact',
      value: this.artifactBucket.bucketName,
      exportName: `${cdk.Aws.STACK_NAME}-ArtifactBucket`,
    });

    new cdk.CfnOutput(this, 'LambdaZipsBucketOutput', {
      description: 'S3 Bucket for the Lambda Function Code',
      value: this.lambdaZipsBucket.bucketName,
      exportName: `${cdk.Aws.STACK_NAME}-LambdaZipsBucket`,
    });

    if (this.beanstalkSourceBucket) {
      new cdk.CfnOutput(this, 'BeanstalkSourceBucketOutput', {
        description: 'S3 Bucket for the CodePipeline Source Stage for Beanstalk',
        value: this.beanstalkSourceBucket.bucketName,
        exportName: `${cdk.Aws.STACK_NAME}-BeanstalkSourceBucket`,
      });
    }
  }
}
