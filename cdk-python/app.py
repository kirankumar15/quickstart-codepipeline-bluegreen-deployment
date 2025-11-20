#!/usr/bin/env python3
"""
AWS CDK Application for Blue-Green Deployment

This application creates a complete CI/CD pipeline for blue-green deployment
to AWS Elastic Beanstalk using AWS CodePipeline, CodeBuild, and Lambda functions.
"""

import os
from aws_cdk import App, Environment, Tags
from bluegreen_deployment.bluegreen_deployment_stack import BlueGreenDeploymentStack


def main():
    """Main application entry point"""
    app = App()

    # Get configuration from context or use defaults
    config = {
        # AWS Elastic Beanstalk configuration
        "beanstalk_source_stage_s3_bucket_name": app.node.try_get_context(
            "beanstalkSourceStageS3BucketName"
        ) or "",
        "beanstalk_source_stage_s3_bucket_key": app.node.try_get_context(
            "beanstalkSourceStageS3BucketKey"
        ) or "app-source.zip",
        "existing_blue_environment_name": app.node.try_get_context(
            "existingBlueEnvironmentName"
        ) or "",
        "existing_beanstalk_application_name": app.node.try_get_context(
            "existingBeanstalkApplicationName"
        ) or "",
        "green_environment_name": app.node.try_get_context(
            "greenEnvironmentName"
        ) or "GreenEnvironment",
        # AWS CodePipeline parameters
        "administrator_email": app.node.try_get_context(
            "administratorEmail"
        ) or "",
        "name_of_the_pipeline": app.node.try_get_context(
            "nameofthePipeline"
        ) or "BlueGreenCICDPipeline",
        # Git2S3 integration parameters
        "git_to_s3_integration": app.node.try_get_context(
            "gitToS3integration"
        ) == "true",
        "custom_domain_name": app.node.try_get_context(
            "customDomainName"
        ) or "",
        "api_secret": app.node.try_get_context("apiSecret") or "",
        "allowed_ips": app.node.try_get_context(
            "allowedIps"
        ) or "131.103.20.160/27,165.254.145.0/26,104.192.143.0/24",
        # Quick Start configuration
        "qss3_bucket_name": app.node.try_get_context(
            "qss3BucketName"
        ) or "aws-quickstart",
        "qss3_bucket_region": app.node.try_get_context(
            "qss3BucketRegion"
        ) or "us-east-1",
        "qss3_key_prefix": app.node.try_get_context(
            "qss3KeyPrefix"
        ) or "quickstart-codepipeline-bluegreen-deployment/",
    }

    # Validate required parameters
    if not config["administrator_email"]:
        raise ValueError(
            "administratorEmail is required. "
            "Please provide it via context: -c administratorEmail=your@email.com"
        )

    if not config["beanstalk_source_stage_s3_bucket_key"]:
        raise ValueError(
            "beanstalkSourceStageS3BucketKey is required. "
            "Please provide it via context."
        )

    # Environment configuration
    env = Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=os.environ.get("CDK_DEFAULT_REGION"),
    )

    # Create the main stack
    stack = BlueGreenDeploymentStack(
        app,
        "BlueGreenDeploymentStack",
        config=config,
        env=env,
        description="CICD Pipeline setup for cost efficient Elastic Beanstalk "
                    "Blue-Green deployment (CDK Python version)",
    )

    # Add tags
    Tags.of(stack).add("Application", "BlueGreenDeployment")
    Tags.of(stack).add("ManagedBy", "CDK")

    app.synth()


if __name__ == "__main__":
    main()
