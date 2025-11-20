"""Stack that manages Lambda assets and S3 buckets"""

from typing import Optional
from aws_cdk import (
    NestedStack,
    RemovalPolicy,
    CfnOutput,
    Aws,
    Duration,
    CustomResource,
)
from aws_cdk.aws_s3 import Bucket, BucketEncryption, IBucket
from aws_cdk.aws_lambda import Function, Runtime, Code
from aws_cdk.aws_iam import Role, ServicePrincipal, ManagedPolicy, PolicyStatement, Effect
from constructs import Construct


class LambdaAssetsStack(NestedStack):
    """
    Stack that manages Lambda assets and S3 buckets
    
    Creates:
    - S3 bucket for CodePipeline artifacts
    - S3 bucket for Lambda function code
    - Optional S3 bucket for Beanstalk source
    - Custom resource to copy Lambda code from Quick Start bucket
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        qss3_bucket_name: str,
        qss3_bucket_region: str,
        qss3_key_prefix: str,
        create_beanstalk_source_bucket: bool,
        git_to_s3_integration: bool,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create CodePipeline artifact store bucket
        self.artifact_bucket: IBucket = Bucket(
            self,
            "CodePipelineArtifactStore",
            versioned=False,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
        )

        # Create Lambda zips bucket
        self.lambda_zips_bucket: IBucket = Bucket(
            self,
            "LambdaZipsBucket",
            versioned=True,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
        )

        # Create Beanstalk source bucket if needed
        self.beanstalk_source_bucket: Optional[IBucket] = None
        if create_beanstalk_source_bucket:
            self.beanstalk_source_bucket = Bucket(
                self,
                "BeanstalkSourceBucket",
                versioned=True,
                removal_policy=RemovalPolicy.DESTROY,
                auto_delete_objects=True,
                encryption=BucketEncryption.S3_MANAGED,
                enforce_ssl=True,
            )

        # Create IAM role for copy Lambda function
        copy_role = Role(
            self,
            "CopyRole",
            assumed_by=ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ],
        )

        # Determine source bucket name based on region
        using_default_bucket = qss3_bucket_name == "aws-quickstart"
        source_bucket_name = (
            f"{qss3_bucket_name}-{Aws.REGION}"
            if using_default_bucket
            else qss3_bucket_name
        )

        # Add permissions to read from source bucket
        copy_role.add_to_policy(
            PolicyStatement(
                effect=Effect.ALLOW,
                actions=["s3:GetObject"],
                resources=[
                    f"arn:{Aws.PARTITION}:s3:::{source_bucket_name}/{qss3_key_prefix}*"
                ],
            )
        )

        # Add permissions to write to destination bucket
        copy_role.add_to_policy(
            PolicyStatement(
                effect=Effect.ALLOW,
                actions=["s3:PutObject", "s3:DeleteObject"],
                resources=[f"{self.lambda_zips_bucket.bucket_arn}/*"],
            )
        )

        # Create Lambda function to copy files
        copy_zips_function = Function(
            self,
            "CopyZipsFunction",
            runtime=Runtime.PYTHON_3_9,
            handler="index.handler",
            timeout=Duration.minutes(4),
            role=copy_role,
            code=Code.from_inline("""
import json
import logging
import threading
import boto3
import cfnresponse

def copy_objects(source_bucket, dest_bucket, prefix, objects):
    s3 = boto3.client('s3')
    for o in objects:
        key = prefix + o
        copy_source = {'Bucket': source_bucket, 'Key': key}
        print(f'Copying {key} from {source_bucket} to {dest_bucket}')
        s3.copy_object(CopySource=copy_source, Bucket=dest_bucket, Key=key)

def delete_objects(bucket, prefix, objects):
    s3 = boto3.client('s3')
    objects_to_delete = {'Objects': [{'Key': prefix + o} for o in objects]}
    s3.delete_objects(Bucket=bucket, Delete=objects_to_delete)

def timeout(event, context):
    logging.error('Execution is about to time out')
    cfnresponse.send(event, context, cfnresponse.FAILED, {}, None)

def handler(event, context):
    timer = threading.Timer(
        (context.get_remaining_time_in_millis() / 1000.00) - 0.5,
        timeout,
        args=[event, context]
    )
    timer.start()
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
"""),
        )

        # Lambda packages to copy
        lambda_packages = [
            "functions/packages/CreateEnvironment/creategreenenv.zip",
            "functions/packages/SwapEnvironments/swapenvironments.zip",
            "functions/packages/TestBlueEnvironment/testBlueenvironment.zip",
            "functions/packages/TerminateandReSwap/terminategreenenv.zip",
        ]

        # Create custom resource to trigger the copy
        CustomResource(
            self,
            "CopyZips",
            service_token=copy_zips_function.function_arn,
            properties={
                "SourceBucket": source_bucket_name,
                "DestBucket": self.lambda_zips_bucket.bucket_name,
                "Prefix": qss3_key_prefix,
                "Objects": lambda_packages,
            },
        )

        # Outputs
        CfnOutput(
            self,
            "CodePipelineArtifactStoreOutput",
            description="S3 Bucket for the CodePipeline Artifact",
            value=self.artifact_bucket.bucket_name,
            export_name=f"{Aws.STACK_NAME}-ArtifactBucket",
        )

        CfnOutput(
            self,
            "LambdaZipsBucketOutput",
            description="S3 Bucket for the Lambda Function Code",
            value=self.lambda_zips_bucket.bucket_name,
            export_name=f"{Aws.STACK_NAME}-LambdaZipsBucket",
        )

        if self.beanstalk_source_bucket:
            CfnOutput(
                self,
                "BeanstalkSourceBucketOutput",
                description="S3 Bucket for the CodePipeline Source Stage for Beanstalk",
                value=self.beanstalk_source_bucket.bucket_name,
                export_name=f"{Aws.STACK_NAME}-BeanstalkSourceBucket",
            )
