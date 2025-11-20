"""Stack that creates Elastic Beanstalk resources"""

from typing import Optional
from aws_cdk import (
    NestedStack,
    CfnOutput,
    Aws,
)
from aws_cdk.aws_elasticbeanstalk import (
    CfnApplication,
    CfnEnvironment,
    CfnApplicationVersion,
)
from aws_cdk.aws_iam import (
    Role,
    ServicePrincipal,
    PolicyStatement,
    Effect,
    CfnInstanceProfile,
)
from constructs import Construct


class ElasticBeanstalkStack(NestedStack):
    """
    Stack that creates sample Elastic Beanstalk Application and Environment
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        existing_blue_environment_name: str,
        existing_beanstalk_application_name: str,
        green_environment_name: str,
        new_blue_environment_name: str,
        new_beanstalk_application_name: str,
        solution_stack_for_new_beanstalk_env: str,
        app_package_s3_bucket: str,
        app_package_s3_key: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        create_new_beanstalk_app = not existing_beanstalk_application_name
        create_new_beanstalk_env = not existing_blue_environment_name

        self.application_name: Optional[str] = None
        self.environment_name: Optional[str] = None
        self.environment_endpoint_url: Optional[str] = None

        application: Optional[CfnApplication] = None
        environment: Optional[CfnEnvironment] = None

        # Create Application if needed
        if create_new_beanstalk_app:
            application = CfnApplication(
                self,
                "BeanstalkApplication",
                application_name=new_beanstalk_application_name,
                description="AWS Elastic Beanstalk Application for Blue-Green Deployment",
            )
            self.application_name = new_beanstalk_application_name
        else:
            self.application_name = existing_beanstalk_application_name

        # Create Environment if needed
        if create_new_beanstalk_env:
            # Create Instance Profile Role
            instance_profile_role = Role(
                self,
                "BeanstalkInstanceProfileRole",
                assumed_by=ServicePrincipal("ec2.amazonaws.com"),
                path="/",
            )

            # Add policies
            instance_profile_role.add_to_policy(
                PolicyStatement(
                    sid="BucketAccess",
                    effect=Effect.ALLOW,
                    actions=[
                        "s3:GetObject",
                        "s3:GetObjectVersion",
                        "s3:PutObject",
                        "s3:ListBucket",
                        "s3:ListBucketVersions",
                    ],
                    resources=[
                        f"arn:{Aws.PARTITION}:s3:::elasticbeanstalk-*-{Aws.ACCOUNT_ID}",
                        f"arn:{Aws.PARTITION}:s3:::elasticbeanstalk-*-{Aws.ACCOUNT_ID}/*",
                        f"arn:{Aws.PARTITION}:s3:::elasticbeanstalk-*-{Aws.ACCOUNT_ID}-*",
                        f"arn:{Aws.PARTITION}:s3:::elasticbeanstalk-*-{Aws.ACCOUNT_ID}-*/*",
                    ],
                )
            )

            instance_profile_role.add_to_policy(
                PolicyStatement(
                    sid="MetricsAccess",
                    effect=Effect.ALLOW,
                    actions=["cloudwatch:PutMetricData"],
                    resources=["*"],
                )
            )

            instance_profile_role.add_to_policy(
                PolicyStatement(
                    sid="CloudWatchLogsAccess",
                    effect=Effect.ALLOW,
                    actions=[
                        "logs:PutLogEvents",
                        "logs:CreateLogStream",
                        "logs:DescribeLogStreams",
                        "logs:DescribeLogGroups",
                    ],
                    resources=[
                        f"arn:{Aws.PARTITION}:logs:*:*:log-group:/aws/elasticbeanstalk*"
                    ],
                )
            )

            # Create Instance Profile
            instance_profile = CfnInstanceProfile(
                self,
                "BeanstalkInstanceProfile",
                path="/",
                roles=[instance_profile_role.role_name],
            )

            # Create Service Role
            service_role = Role(
                self,
                "BeanstalkServiceRole",
                assumed_by=ServicePrincipal("elasticbeanstalk.amazonaws.com"),
                path="/",
            )

            service_role.assume_role_policy.add_statements(
                PolicyStatement(
                    sid="",
                    effect=Effect.ALLOW,
                    principals=[ServicePrincipal("elasticbeanstalk.amazonaws.com")],
                    actions=["sts:AssumeRole"],
                    conditions={
                        "StringEquals": {"sts:ExternalId": "elasticbeanstalk"}
                    },
                )
            )

            service_role.add_to_policy(
                PolicyStatement(
                    effect=Effect.ALLOW,
                    actions=[
                        "elasticloadbalancing:DescribeInstanceHealth",
                        "ec2:DescribeInstances",
                        "ec2:DescribeInstanceStatus",
                        "ec2:GetConsoleOutput",
                        "ec2:AssociateAddress",
                        "ec2:DescribeAddresses",
                        "ec2:DescribeSecurityGroups",
                        "sqs:GetQueueAttributes",
                        "sqs:GetQueueUrl",
                        "autoscaling:DescribeAutoScalingGroups",
                        "autoscaling:DescribeAutoScalingInstances",
                        "autoscaling:DescribeScalingActivities",
                        "autoscaling:DescribeNotificationConfigurations",
                    ],
                    resources=["*"],
                )
            )

            # Determine source bucket
            is_sample_app = app_package_s3_bucket == "elasticbeanstalk-samples"
            source_bucket = (
                f"{app_package_s3_bucket}-{Aws.REGION}"
                if is_sample_app
                else app_package_s3_bucket
            )

            # Create Application Version
            app_version = CfnApplicationVersion(
                self,
                "BeanstalkAppVersion",
                application_name=self.application_name,
                description="Sample application version for blue-green deployment",
                source_bundle={
                    "s3Bucket": source_bucket,
                    "s3Key": app_package_s3_key,
                },
            )

            if application:
                app_version.add_dependency(application)

            # Create Environment
            environment = CfnEnvironment(
                self,
                "BeanstalkEnvironment",
                application_name=self.application_name,
                environment_name=new_blue_environment_name,
                description="AWS Elastic Beanstalk Environment for Blue-Green Deployment",
                solution_stack_name=solution_stack_for_new_beanstalk_env,
                version_label=app_version.ref,
                option_settings=[
                    {
                        "namespace": "aws:autoscaling:launchconfiguration",
                        "optionName": "IamInstanceProfile",
                        "value": instance_profile.ref,
                    },
                    {
                        "namespace": "aws:elasticbeanstalk:environment",
                        "optionName": "ServiceRole",
                        "value": service_role.role_name,
                    },
                ],
            )

            environment.add_dependency(app_version)

            self.environment_name = new_blue_environment_name
            self.environment_endpoint_url = environment.attr_endpoint_url
        else:
            self.environment_name = existing_blue_environment_name

        # Outputs
        if environment:
            CfnOutput(
                self,
                "BeanstalkEnvironmentOutput",
                description="Beanstalk Environment Name",
                value=environment.ref,
            )

            CfnOutput(
                self,
                "BeanstalkEnvEndPointUrlOutput",
                description="New Beanstalk Environment Endpoint URL",
                value=environment.attr_endpoint_url,
            )
