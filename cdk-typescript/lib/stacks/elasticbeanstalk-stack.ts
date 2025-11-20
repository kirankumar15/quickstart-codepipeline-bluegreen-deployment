import * as cdk from 'aws-cdk-lib';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ElasticBeanstalkStackProps {
  existingBlueEnvironmentName: string;
  existingBeanstalkApplicationName: string;
  greenEnvironmentName: string;
  newBlueEnvironmentName: string;
  newBeanstalkApplicationName: string;
  solutionStackForNewBeanstalkEnv: string;
  appPackageS3Bucket: string;
  appPackageS3key: string;
}

/**
 * Stack that creates sample Elastic Beanstalk Application and Environment
 * 
 * Creates:
 * - Elastic Beanstalk Application (if needed)
 * - Elastic Beanstalk Environment (if needed)
 * - IAM roles for Elastic Beanstalk
 */
export class ElasticBeanstalkStack extends cdk.NestedStack {
  public readonly applicationName?: string;
  public readonly environmentName?: string;
  public readonly environmentEndpointUrl?: string;

  constructor(scope: Construct, id: string, props: ElasticBeanstalkStackProps) {
    super(scope, id);

    const createNewBeanstalkApp = !props.existingBeanstalkApplicationName;
    const createNewBeanstalkEnv = !props.existingBlueEnvironmentName;

    let application: elasticbeanstalk.CfnApplication | undefined;
    let environment: elasticbeanstalk.CfnEnvironment | undefined;

    // Create Beanstalk Application if needed
    if (createNewBeanstalkApp) {
      application = new elasticbeanstalk.CfnApplication(this, 'BeanstalkApplication', {
        applicationName: props.newBeanstalkApplicationName,
        description: 'AWS Elastic Beanstalk PHP Sample Application for Blue-Green Deployment',
      });
      this.applicationName = props.newBeanstalkApplicationName;
    } else {
      this.applicationName = props.existingBeanstalkApplicationName;
    }

    // Create Beanstalk Environment if needed
    if (createNewBeanstalkEnv) {
      // Create IAM Instance Profile Role
      const instanceProfileRole = new iam.Role(this, 'BeanstalkInstanceProfileRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        path: '/',
      });

      // Add policies to instance profile role
      instanceProfileRole.addToPolicy(new iam.PolicyStatement({
        sid: 'BucketAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
          's3:PutObject',
          's3:ListBucket',
          's3:ListBucketVersions',
        ],
        resources: [
          `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk-*-${cdk.Aws.ACCOUNT_ID}`,
          `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk-*-${cdk.Aws.ACCOUNT_ID}/*`,
          `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk-*-${cdk.Aws.ACCOUNT_ID}-*`,
          `arn:${cdk.Aws.PARTITION}:s3:::elasticbeanstalk-*-${cdk.Aws.ACCOUNT_ID}-*/*`,
        ],
      }));

      instanceProfileRole.addToPolicy(new iam.PolicyStatement({
        sid: 'MetricsAccess',
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      }));

      instanceProfileRole.addToPolicy(new iam.PolicyStatement({
        sid: 'CloudWatchLogsAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:PutLogEvents',
          'logs:CreateLogStream',
          'logs:DescribeLogStreams',
          'logs:DescribeLogGroups',
        ],
        resources: [
          `arn:${cdk.Aws.PARTITION}:logs:*:*:log-group:/aws/elasticbeanstalk*`,
        ],
      }));

      // Create Instance Profile
      const instanceProfile = new iam.CfnInstanceProfile(this, 'BeanstalkInstanceProfile', {
        path: '/',
        roles: [instanceProfileRole.roleName],
      });

      // Create Beanstalk Service Role
      const serviceRole = new iam.Role(this, 'BeanstalkServiceRole', {
        assumedBy: new iam.ServicePrincipal('elasticbeanstalk.amazonaws.com'),
        path: '/',
      });

      serviceRole.assumeRolePolicy?.addStatements(
        new iam.PolicyStatement({
          sid: '',
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal('elasticbeanstalk.amazonaws.com')],
          actions: ['sts:AssumeRole'],
          conditions: {
            StringEquals: {
              'sts:ExternalId': 'elasticbeanstalk',
            },
          },
        })
      );

      serviceRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'elasticloadbalancing:DescribeInstanceHealth',
          'ec2:DescribeInstances',
          'ec2:DescribeInstanceStatus',
          'ec2:GetConsoleOutput',
          'ec2:AssociateAddress',
          'ec2:DescribeAddresses',
          'ec2:DescribeSecurityGroups',
          'sqs:GetQueueAttributes',
          'sqs:GetQueueUrl',
          'autoscaling:DescribeAutoScalingGroups',
          'autoscaling:DescribeAutoScalingInstances',
          'autoscaling:DescribeScalingActivities',
          'autoscaling:DescribeNotificationConfigurations',
        ],
        resources: ['*'],
      }));

      // Determine S3 bucket for sample app
      const isSampleApp = props.appPackageS3Bucket === 'elasticbeanstalk-samples';
      const sourceBucket = isSampleApp 
        ? `${props.appPackageS3Bucket}-${cdk.Aws.REGION}`
        : props.appPackageS3Bucket;

      // Create Application Version
      const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, 'BeanstalkAppVersion', {
        applicationName: this.applicationName,
        description: 'Sample application version for blue-green deployment',
        sourceBundle: {
          s3Bucket: sourceBucket,
          s3Key: props.appPackageS3key,
        },
      });

      if (application) {
        appVersion.addDependency(application);
      }

      // Create Environment
      environment = new elasticbeanstalk.CfnEnvironment(this, 'BeanstalkEnvironment', {
        applicationName: this.applicationName,
        environmentName: props.newBlueEnvironmentName,
        description: 'AWS Elastic Beanstalk Environment running Sample Application for Blue-Green Deployment',
        solutionStackName: props.solutionStackForNewBeanstalkEnv,
        versionLabel: appVersion.ref,
        optionSettings: [
          {
            namespace: 'aws:autoscaling:launchconfiguration',
            optionName: 'IamInstanceProfile',
            value: instanceProfile.ref,
          },
          {
            namespace: 'aws:elasticbeanstalk:environment',
            optionName: 'ServiceRole',
            value: serviceRole.roleName,
          },
        ],
      });

      environment.addDependency(appVersion);

      this.environmentName = props.newBlueEnvironmentName;
      this.environmentEndpointUrl = environment.attrEndpointUrl;
    } else {
      this.environmentName = props.existingBlueEnvironmentName;
    }

    // Outputs
    if (environment) {
      new cdk.CfnOutput(this, 'BeanstalkEnvironmentOutput', {
        description: 'Beanstalk Environment Name',
        value: environment.ref,
      });

      new cdk.CfnOutput(this, 'BeanstalkEnvEndPointUrlOutput', {
        description: 'New Beanstalk Environment Endpoint URL',
        value: environment.attrEndpointUrl,
      });
    }
  }
}
