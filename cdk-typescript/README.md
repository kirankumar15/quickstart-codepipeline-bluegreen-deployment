# Blue-Green Deployment CDK - TypeScript Implementation

This directory contains the AWS CDK (TypeScript) implementation of the Blue-Green Deployment Quick Start for AWS Elastic Beanstalk.

## Overview

This CDK application automatically builds an architecture for blue-green deployment to an AWS Elastic Beanstalk environment using AWS CodePipeline. It creates a continuous integration/continuous delivery pipeline for a cost-effective, fault-tolerant architecture.

## Architecture

The CDK implementation creates the following resources:

1. **Lambda Assets Stack**
   - S3 bucket for CodePipeline artifacts
   - S3 bucket for Lambda function code
   - Optional S3 bucket for Beanstalk source code
   - Custom resource to copy Lambda functions from Quick Start bucket

2. **Elastic Beanstalk Stack** (Optional)
   - Elastic Beanstalk Application
   - Elastic Beanstalk Environment (Blue environment)
   - IAM roles and instance profiles

3. **CodePipeline Stack**
   - CodePipeline with 7 stages:
     - **Source**: Pull application code and Lambda functions from S3
     - **Lambda**: Create green environment (clone of blue)
     - **Manual Approval**: Wait for approval before swapping
     - **Swap URL**: Route traffic from blue to green using CodeBuild
     - **Deploy**: Deploy new version to blue environment
     - **Test**: Test the blue environment using CodeBuild
     - **Cleanup**: Swap traffic back to blue and terminate green
   - CodeBuild projects for URL swap and testing
   - Lambda functions for environment management
   - SNS topic for manual approval notifications

## Prerequisites

- Node.js 18.x or later
- AWS CDK CLI 2.100.0 or later
- AWS CLI configured with appropriate credentials
- An AWS account with permissions to create the required resources

## Installation

1. Navigate to the cdk-typescript directory:
```bash
cd cdk-typescript
```

2. Install dependencies:
```bash
npm install
```

3. Bootstrap your AWS environment (if not already done):
```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

## Configuration

The CDK application accepts configuration through context parameters. You can provide these in several ways:

### Option 1: Command-line context

```bash
npx cdk deploy \
  --context administratorEmail=your@email.com \
  --context beanstalkSourceStageS3BucketKey=app-source.zip \
  --context existingBlueEnvironmentName=MyBlueEnv \
  --context existingBeanstalkApplicationName=MyApp
```

### Option 2: cdk.context.json file

Create a `cdk.context.json` file in the cdk-typescript directory:

```json
{
  "administratorEmail": "your@email.com",
  "beanstalkSourceStageS3BucketKey": "app-source.zip",
  "existingBlueEnvironmentName": "",
  "existingBeanstalkApplicationName": "",
  "greenEnvironmentName": "GreenEnvironment",
  "nameofthePipeline": "BlueGreenCICDPipeline",
  "qss3BucketName": "aws-quickstart",
  "qss3BucketRegion": "us-east-1",
  "qss3KeyPrefix": "quickstart-codepipeline-bluegreen-deployment/"
}
```

### Configuration Parameters

#### Required Parameters

- **administratorEmail**: Email address for manual approval notifications (required)
- **beanstalkSourceStageS3BucketKey**: S3 key for the application source package (required)

#### Optional Parameters - Elastic Beanstalk

- **beanstalkSourceStageS3BucketName**: S3 bucket name for source stage (leave empty to create new)
- **existingBlueEnvironmentName**: Name of existing blue environment (leave empty to create sample)
- **existingBeanstalkApplicationName**: Name of existing Beanstalk application (leave empty to create sample)
- **greenEnvironmentName**: Name for the green environment (default: "GreenEnvironment")

#### Optional Parameters - CodePipeline

- **nameofthePipeline**: Name of the CI/CD pipeline (default: "BlueGreenCICDPipeline")

#### Optional Parameters - Quick Start

- **qss3BucketName**: S3 bucket for Quick Start assets (default: "aws-quickstart")
- **qss3BucketRegion**: Region for Quick Start bucket (default: "us-east-1")
- **qss3KeyPrefix**: S3 key prefix for Quick Start assets

## Usage

### Synthesize CloudFormation Template

To generate the CloudFormation template without deploying:

```bash
npm run synth
```

This will create the CloudFormation templates in the `cdk.out` directory.

### Deploy the Stack

To deploy with a new sample Beanstalk environment:

```bash
npx cdk deploy --context administratorEmail=your@email.com
```

To deploy with an existing Beanstalk environment:

```bash
npx cdk deploy \
  --context administratorEmail=your@email.com \
  --context beanstalkSourceStageS3BucketKey=myapp/app.zip \
  --context existingBlueEnvironmentName=MyBlueEnvironment \
  --context existingBeanstalkApplicationName=MyApplication
```

### View Differences

To see what changes will be made:

```bash
npm run diff
```

### Destroy the Stack

To remove all created resources:

```bash
npm run destroy
```

## Project Structure

```
cdk-typescript/
├── bin/
│   └── app.ts                          # CDK application entry point
├── lib/
│   ├── bluegreen-deployment-stack.ts   # Main stack orchestrator
│   └── stacks/
│       ├── lambda-assets-stack.ts      # S3 buckets and Lambda assets
│       ├── elasticbeanstalk-stack.ts   # Elastic Beanstalk resources
│       └── codepipeline-stack.ts       # CodePipeline and related resources
├── cdk.json                            # CDK configuration
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Node.js dependencies
└── README.md                           # This file
```

## How It Works

### Blue-Green Deployment Process

1. **Initial State**: Application runs on the Blue environment serving production traffic

2. **Green Environment Creation**: 
   - Lambda function creates a clone of the Blue environment (Green environment)
   - Green environment starts with the same configuration as Blue

3. **Manual Approval**: 
   - Pipeline pauses for manual approval
   - Administrator receives email notification via SNS

4. **URL Swap**: 
   - CodeBuild project swaps the URLs
   - Production traffic is routed to Green environment
   - Blue environment is now free for deployment

5. **Deploy to Blue**: 
   - New application version is deployed to Blue environment
   - Deployment happens without impacting production traffic

6. **Test Blue**: 
   - CodeBuild project runs tests against the Blue environment
   - Verifies the new deployment is working correctly

7. **Re-swap and Cleanup**: 
   - Lambda function swaps URLs back to Blue environment
   - Production traffic returns to Blue (now with new version)
   - Green environment is terminated to save costs

### Cost Optimization

The green environment only exists during the deployment process, which significantly reduces costs compared to maintaining two full environments at all times.

## Differences from CloudFormation Implementation

While this CDK implementation maintains the same functionality as the original CloudFormation templates, there are some notable improvements:

1. **Type Safety**: TypeScript provides compile-time type checking
2. **Code Reusability**: Constructs can be easily reused and composed
3. **Easier Maintenance**: Higher-level abstractions make the code more maintainable
4. **Better IDE Support**: IntelliSense and auto-completion
5. **Programmatic Logic**: Can use standard programming constructs (loops, conditionals)

## Customization

### Using Your Own Lambda Functions

If you want to use custom Lambda functions instead of the ones from the Quick Start bucket:

1. Place your Lambda function code in the `../functions/source/` directory
2. Update the Lambda function definitions in `codepipeline-stack.ts` to use `lambda.Code.fromAsset()`

### Modifying the Pipeline

To add or modify pipeline stages:

1. Edit `lib/stacks/codepipeline-stack.ts`
2. Add new stages to the `stages` array in the Pipeline definition
3. Redeploy the stack

### Custom Elastic Beanstalk Configuration

To customize the Elastic Beanstalk environment:

1. Edit `lib/stacks/elasticbeanstalk-stack.ts`
2. Modify the `optionSettings` in the CfnEnvironment definition
3. Redeploy the stack

## Troubleshooting

### Issue: CDK Bootstrap Error

**Solution**: Ensure you've bootstrapped your AWS environment:
```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### Issue: Lambda Functions Not Found

**Solution**: Verify that the Quick Start S3 bucket exists in your region and contains the Lambda packages.

### Issue: Manual Approval Email Not Received

**Solution**: Check your email and spam folder. You need to confirm the SNS subscription.

### Issue: Beanstalk Environment Creation Failed

**Solution**: 
- Check that the solution stack name is valid for your region
- Verify you have sufficient service quotas for Elastic Beanstalk

## Testing

To run tests (after implementing them):

```bash
npm test
```

## Security Considerations

1. **IAM Roles**: The Lambda functions and CodeBuild projects have broad permissions. Consider restricting them based on your security requirements.

2. **S3 Buckets**: All S3 buckets are created with encryption enabled and enforce SSL.

3. **Manual Approval**: The manual approval stage adds a human checkpoint before production changes.

4. **Email Notifications**: Ensure the administrator email is monitored for approval requests.

## Contributing

To contribute to this CDK implementation:

1. Make your changes
2. Test thoroughly
3. Update documentation
4. Submit a pull request

## License

This CDK implementation follows the same license as the original Quick Start (Apache 2.0).

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [AWS Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [Original CloudFormation Quick Start](https://aws.amazon.com/quickstart/architecture/blue-green-deployment/)

## Support

For issues specific to this CDK implementation, please open an issue in the GitHub repository.

For AWS service-specific questions, consult the AWS documentation or AWS Support.
