"""Stack that creates the CodePipeline for Blue-Green Deployment"""

from aws_cdk import (
    NestedStack,
    CfnOutput,
    Duration,
    Aws,
    CustomResource,
)
from aws_cdk.aws_codepipeline import (
    Pipeline,
    Artifact,
)
from aws_cdk.aws_codepipeline_actions import (
    S3SourceAction,
    S3Trigger,
    LambdaInvokeAction,
    ManualApprovalAction,
    CodeBuildAction,
    ElasticBeanstalkDeployAction,
)
from aws_cdk.aws_codebuild import (
    Project,
    BuildSpec,
    LinuxBuildImage,
    ComputeType,
)
from aws_cdk.aws_lambda import (
    Function,
    Runtime,
    Code,
)
from aws_cdk.aws_iam import (
    Role,
    ServicePrincipal,
    ManagedPolicy,
    PolicyStatement,
    Effect,
)
from aws_cdk.aws_sns import Topic
from aws_cdk.aws_sns_subscriptions import EmailSubscription
from aws_cdk.aws_s3 import IBucket, Bucket
from constructs import Construct


class CodePipelineStack(NestedStack):
    """
    Stack that creates the CodePipeline for Blue-Green Deployment
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        administrator_email: str,
        name_of_the_pipeline: str,
        qss3_key_prefix: str,
        lambda_zips_bucket: IBucket,
        blue_environment_name: str,
        green_environment_name: str,
        beanstalk_application_name: str,
        beanstalk_source_stage_bucket_key: str,
        beanstalk_source_stage_bucket: str,
        codepipeline_artifact_store: IBucket,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create SNS topic for manual approval
        approval_topic = Topic(
            self,
            "ManualApprovalSNSTopic",
            display_name="Blue-Green Deployment Manual Approval",
        )

        approval_topic.add_subscription(EmailSubscription(administrator_email))

        # Create Lambda execution role
        lambda_execution_role = Role(
            self,
            "LambdaExecutionRole",
            assumed_by=ServicePrincipal("lambda.amazonaws.com"),
            path="/",
            managed_policies=[
                ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                ),
                ManagedPolicy.from_aws_managed_policy_name(
                    "AdministratorAccess-AWSElasticBeanstalk"
                ),
            ],
        )

        lambda_execution_role.add_to_policy(
            PolicyStatement(
                effect=Effect.ALLOW,
                actions=[
                    "codepipeline:PutJobSuccessResult",
                    "codepipeline:PutJobFailureResult",
                ],
                resources=["*"],
            )
        )

        # Create Lambda functions
        create_clone_lambda = Function(
            self,
            "CreateCloneLambdaFunction",
            runtime=Runtime.PYTHON_3_9,
            handler="index.handler",
            role=lambda_execution_role,
            timeout=Duration.minutes(5),
            code=Code.from_bucket(
                lambda_zips_bucket,
                f"{qss3_key_prefix}functions/packages/CreateEnvironment/creategreenenv.zip",
            ),
        )

        terminate_green_lambda = Function(
            self,
            "TerminateGreenEnvLambdaFunction",
            runtime=Runtime.PYTHON_3_9,
            handler="index.handler",
            role=lambda_execution_role,
            timeout=Duration.minutes(5),
            code=Code.from_bucket(
                lambda_zips_bucket,
                f"{qss3_key_prefix}functions/packages/TerminateandReSwap/terminategreenenv.zip",
            ),
        )

        # Create CodeBuild service role
        build_service_role = Role(
            self,
            "BuildServiceRole",
            assumed_by=ServicePrincipal("codebuild.amazonaws.com"),
            path="/",
        )

        build_service_role.add_to_policy(
            PolicyStatement(
                sid="CloudWatchLogsPolicy",
                effect=Effect.ALLOW,
                actions=[
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[f"arn:{Aws.PARTITION}:logs:*:*:log-group:*:*"],
            )
        )

        build_service_role.add_to_policy(
            PolicyStatement(
                sid="S3GetObjectPolicy",
                effect=Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:ListObjects",
                    "s3:GetObjectVersion",
                ],
                resources=[f"arn:{Aws.PARTITION}:s3:::*"],
            )
        )

        build_service_role.add_to_policy(
            PolicyStatement(
                sid="S3PutObjectPolicy",
                effect=Effect.ALLOW,
                actions=["s3:PutObject"],
                resources=[f"arn:{Aws.PARTITION}:s3:::*"],
            )
        )

        build_service_role.add_to_policy(
            PolicyStatement(
                sid="EBAccess",
                effect=Effect.ALLOW,
                actions=[
                    "elasticbeanstalk:SwapEnvironmentCNAMEs",
                    "elasticbeanstalk:DescribeEnvironmentManagedActionHistory",
                    "elasticbeanstalk:DescribeConfigurationSettings",
                    "elasticbeanstalk:DescribeEvents",
                    "elasticbeanstalk:DescribeEnvironments",
                    "elasticbeanstalk:DescribeEnvironmentHealth",
                    "elasticbeanstalk:DescribeAccountAttributes",
                    "elasticbeanstalk:DescribeEnvironmentManagedActions",
                    "elasticbeanstalk:DescribeApplicationVersion",
                    "elasticbeanstalk:DescribePlatformVersion",
                    "elasticbeanstalk:DescribeInstancesHealth",
                    "elasticbeanstalk:DescribeConfigurationOptions",
                    "elasticbeanstalk:DescribeEnvironmentResources",
                    "elasticbeanstalk:DescribeApplications",
                    "cloudformation:GetTemplate",
                ],
                resources=[f"arn:{Aws.PARTITION}:elasticbeanstalk:::*"],
            )
        )

        # Create CodeBuild projects
        swap_url_project = Project(
            self,
            "CodeBuildSwapServer",
            project_name="CICDurlSwap",
            description="CodeBuild Server to swap URLs between Blue and Green Environments",
            role=build_service_role,
            environment={
                "buildImage": LinuxBuildImage.STANDARD_5_0,
                "computeType": ComputeType.SMALL,
                "environmentVariables": {
                    "BlueEnvName": {"value": blue_environment_name},
                    "GreenEnvName": {"value": green_environment_name},
                    "BlueCNAMEConfigBucket": {"value": lambda_zips_bucket.bucket_name},
                    "BlueCNAMEConfigFile": {"value": "bluecnameconfig.json"},
                },
            },
            build_spec=BuildSpec.from_source_filename("buildspec.yml"),
            timeout_in_minutes=60,
        )

        test_blue_project = Project(
            self,
            "CodeBuildTestServer",
            project_name="CICDBlueDeploymentTest",
            description="CodeBuild Test Server for Blue Environment after deployment",
            role=build_service_role,
            environment={
                "buildImage": LinuxBuildImage.STANDARD_5_0,
                "computeType": ComputeType.SMALL,
                "environmentVariables": {
                    "BlueEnvName": {"value": blue_environment_name},
                    "GreenEnvName": {"value": green_environment_name},
                    "BlueCNAMEConfigFile": {"value": "bluecnameconfig.json"},
                },
            },
            build_spec=BuildSpec.from_source_filename("buildspec.yml"),
            timeout_in_minutes=60,
        )

        # Create pipeline service role
        pipeline_role = Role(
            self,
            "PipelineServiceRole",
            assumed_by=ServicePrincipal("codepipeline.amazonaws.com"),
            path="/",
        )

        pipeline_role.add_to_policy(
            PolicyStatement(
                effect=Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:GetObjectVersion",
                    "s3:GetBucketVersioning",
                    "s3:PutObject",
                ],
                resources=[
                    f"arn:{Aws.PARTITION}:s3:::codepipeline*",
                    f"arn:{Aws.PARTITION}:s3:::elasticbeanstalk*",
                ],
            )
        )

        pipeline_role.add_to_policy(
            PolicyStatement(
                effect=Effect.ALLOW,
                actions=[
                    "elasticbeanstalk:*",
                    "ec2:*",
                    "elasticloadbalancing:*",
                    "autoscaling:*",
                    "cloudformation:*",
                    "cloudwatch:*",
                    "sns:*",
                    "rds:*",
                    "sqs:*",
                    "ecs:*",
                    "iam:PassRole",
                    "lambda:InvokeFunction",
                    "lambda:ListFunctions",
                    "codebuild:BatchGetBuilds",
                    "codebuild:StartBuild",
                ],
                resources=["*"],
            )
        )

        # Get source bucket
        source_bucket = Bucket.from_bucket_name(
            self, "SourceBucket", beanstalk_source_stage_bucket
        )

        # Define artifacts
        source_artifact = Artifact("ElasticBeanstalkPackage")
        url_swap_artifact = Artifact("UrlSwapPackage")
        test_artifact = Artifact("BlueEnvTestPackage")

        # Create the pipeline
        self.pipeline = Pipeline(
            self,
            "BlueGreenCICDPipeline",
            pipeline_name=name_of_the_pipeline,
            artifact_bucket=codepipeline_artifact_store,
            role=pipeline_role,
            stages=[
                {
                    "stageName": "SourceForElasticBeanstalk",
                    "actions": [
                        S3SourceAction(
                            action_name="SourceForElasticBeanstalk",
                            bucket=source_bucket,
                            bucket_key=beanstalk_source_stage_bucket_key,
                            output=source_artifact,
                            trigger=S3Trigger.POLL,
                        ),
                        S3SourceAction(
                            action_name="SourceForCodeBuildStage",
                            bucket=lambda_zips_bucket,
                            bucket_key=f"{qss3_key_prefix}functions/packages/SwapEnvironments/swapenvironments.zip",
                            output=url_swap_artifact,
                            trigger=S3Trigger.NONE,
                            run_order=2,
                        ),
                        S3SourceAction(
                            action_name="SourceForCodeBuildTestStage",
                            bucket=lambda_zips_bucket,
                            bucket_key=f"{qss3_key_prefix}functions/packages/TestBlueEnvironment/testBlueenvironment.zip",
                            output=test_artifact,
                            trigger=S3Trigger.NONE,
                            run_order=2,
                        ),
                    ],
                },
                {
                    "stageName": "Lambda",
                    "actions": [
                        LambdaInvokeAction(
                            action_name="LambdaFunctionForNewEnvCreation",
                            lambda_=create_clone_lambda,
                            user_parameters={
                                "BlueEnvName": blue_environment_name,
                                "GreenEnvName": green_environment_name,
                                "BlueCNAMEConfigBucket": lambda_zips_bucket.bucket_name,
                                "BeanstalkAppName": beanstalk_application_name,
                                "CreateConfigTempName": "BlueEnvConfig",
                                "BlueCNAMEConfigFile": "bluecnameconfig.json",
                            },
                        )
                    ],
                },
                {
                    "stageName": "ManualApprovalForUrlSwap",
                    "actions": [
                        ManualApprovalAction(
                            action_name="manualapp",
                            notification_topic=approval_topic,
                            additional_information="Please approve to swap URLs from Blue to Green environment",
                        )
                    ],
                },
                {
                    "stageName": "SwapUrlCodeBuild",
                    "actions": [
                        CodeBuildAction(
                            action_name="SwapUrlBeanstalk",
                            project=swap_url_project,
                            input=url_swap_artifact,
                        )
                    ],
                },
                {
                    "stageName": "DeploytoBlueEnvironment",
                    "actions": [
                        ElasticBeanstalkDeployAction(
                            action_name="BeanstalkBlueDeploy",
                            application_name=beanstalk_application_name,
                            environment_name=blue_environment_name,
                            input=source_artifact,
                        )
                    ],
                },
                {
                    "stageName": "BlueEnvTestCodeBuild",
                    "actions": [
                        CodeBuildAction(
                            action_name="BlueEnvTestBeanstalk",
                            project=test_blue_project,
                            input=test_artifact,
                        )
                    ],
                },
                {
                    "stageName": "ReswapAndCleanUpGreenEnv",
                    "actions": [
                        LambdaInvokeAction(
                            action_name="ReswapAndCleanUpGreenEnv",
                            lambda_=terminate_green_lambda,
                            user_parameters={
                                "BlueEnvName": blue_environment_name,
                                "GreenEnvName": green_environment_name,
                                "BlueCNAMEConfigBucket": lambda_zips_bucket.bucket_name,
                                "BeanstalkAppName": beanstalk_application_name,
                                "CreateConfigTempName": "BlueEnvConfig",
                                "BlueCNAMEConfigFile": "bluecnameconfig.json",
                            },
                        )
                    ],
                },
            ],
        )

        # Outputs
        CfnOutput(
            self,
            "PipelineNameOutput",
            description="Name of the CodePipeline",
            value=self.pipeline.pipeline_name,
        )

        CfnOutput(
            self,
            "PipelineArnOutput",
            description="ARN of the CodePipeline",
            value=self.pipeline.pipeline_arn,
        )
