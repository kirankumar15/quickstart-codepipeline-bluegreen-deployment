"""Main stack for Blue-Green Deployment"""

from typing import Dict, Any, Optional
from aws_cdk import Stack, CfnOutput
from constructs import Construct

from .stacks.lambda_assets_stack import LambdaAssetsStack
from .stacks.elasticbeanstalk_stack import ElasticBeanstalkStack
from .stacks.codepipeline_stack import CodePipelineStack


class BlueGreenDeploymentStack(Stack):
    """
    Main Stack for Blue-Green Deployment
    
    This stack orchestrates the creation of:
    1. Lambda assets and S3 buckets for pipeline artifacts
    2. Optional Elastic Beanstalk sample application
    3. CodePipeline with blue-green deployment stages
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: Dict[str, Any],
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Determine if we need to create new Beanstalk resources
        create_new_beanstalk_env = not config["existing_blue_environment_name"]
        create_new_beanstalk_app = not config["existing_beanstalk_application_name"]
        create_beanstalk_stack = create_new_beanstalk_env or create_new_beanstalk_app

        # Determine if we need to create bucket for Beanstalk source
        create_bucket_for_beanstalk_source = (
            not config["beanstalk_source_stage_s3_bucket_name"] 
            and not config["git_to_s3_integration"]
        )

        # 1. Create Lambda Assets Stack
        lambda_assets_stack = LambdaAssetsStack(
            self,
            "LambdaAssets",
            qss3_bucket_name=config["qss3_bucket_name"],
            qss3_bucket_region=config["qss3_bucket_region"],
            qss3_key_prefix=config["qss3_key_prefix"],
            create_beanstalk_source_bucket=create_bucket_for_beanstalk_source,
            git_to_s3_integration=config["git_to_s3_integration"],
        )

        # Determine the Beanstalk source bucket
        if config["git_to_s3_integration"]:
            # If Git2S3 integration is enabled, would use the Git2S3 output bucket
            # For now, create a bucket as Git2S3 integration is complex
            beanstalk_source_bucket = (
                lambda_assets_stack.beanstalk_source_bucket.bucket_name
                if lambda_assets_stack.beanstalk_source_bucket
                else ""
            )
        elif create_bucket_for_beanstalk_source:
            beanstalk_source_bucket = (
                lambda_assets_stack.beanstalk_source_bucket.bucket_name
            )
        else:
            beanstalk_source_bucket = config["beanstalk_source_stage_s3_bucket_name"]

        # 2. Create Elastic Beanstalk Stack (if needed)
        beanstalk_stack: Optional[ElasticBeanstalkStack] = None
        blue_environment_name: str
        beanstalk_application_name: str

        if create_beanstalk_stack:
            beanstalk_stack = ElasticBeanstalkStack(
                self,
                "BeanstalkSample",
                existing_blue_environment_name=config["existing_blue_environment_name"],
                existing_beanstalk_application_name=config[
                    "existing_beanstalk_application_name"
                ],
                green_environment_name=config["green_environment_name"],
                new_blue_environment_name="BlueEnvironment",
                new_beanstalk_application_name="BlueGreenBeanstalkApplication",
                solution_stack_for_new_beanstalk_env=(
                    "64bit Amazon Linux 2 v3.3.1 running PHP 7.4"
                ),
                app_package_s3_bucket="elasticbeanstalk-samples",
                app_package_s3_key="php-sample.zip",
            )

            blue_environment_name = (
                beanstalk_stack.environment_name
                or config["existing_blue_environment_name"]
            )
            beanstalk_application_name = (
                beanstalk_stack.application_name
                or config["existing_beanstalk_application_name"]
            )
        else:
            blue_environment_name = config["existing_blue_environment_name"]
            beanstalk_application_name = config["existing_beanstalk_application_name"]

        # 3. Create CodePipeline Stack
        codepipeline_stack = CodePipelineStack(
            self,
            "CodePipeline",
            administrator_email=config["administrator_email"],
            name_of_the_pipeline=config["name_of_the_pipeline"],
            qss3_key_prefix=config["qss3_key_prefix"],
            lambda_zips_bucket=lambda_assets_stack.lambda_zips_bucket,
            blue_environment_name=blue_environment_name,
            green_environment_name=config["green_environment_name"],
            beanstalk_application_name=beanstalk_application_name,
            beanstalk_source_stage_bucket_key=config[
                "beanstalk_source_stage_s3_bucket_key"
            ],
            beanstalk_source_stage_bucket=beanstalk_source_bucket,
            codepipeline_artifact_store=lambda_assets_stack.artifact_bucket,
        )

        # Add dependencies
        if beanstalk_stack:
            codepipeline_stack.add_dependency(beanstalk_stack)
        codepipeline_stack.add_dependency(lambda_assets_stack)

        # Outputs
        CfnOutput(
            self,
            "CodePipelineName",
            description="Name of the Pipeline",
            value=config["name_of_the_pipeline"],
        )

        CfnOutput(
            self,
            "BlueEnvironmentName",
            description="Name of the Blue Environment",
            value=blue_environment_name,
        )

        CfnOutput(
            self,
            "GreenEnvironmentName",
            description="Name of the Green Environment",
            value=config["green_environment_name"],
        )

        CfnOutput(
            self,
            "BeanstalkSourceBucketName",
            description=(
                "Name of the bucket where the application code should be uploaded "
                "for the Elastic Beanstalk application"
            ),
            value=beanstalk_source_bucket,
        )

        if (
            beanstalk_stack
            and create_new_beanstalk_env
            and beanstalk_stack.environment_endpoint_url
        ):
            CfnOutput(
                self,
                "NewBeanstalkEnvEndPointUrl",
                description="New Beanstalk Environment Endpoint URL",
                value=f"http://{beanstalk_stack.environment_endpoint_url}",
            )
