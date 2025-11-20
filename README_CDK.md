# AWS CDK Implementation - Blue-Green Deployment for Elastic Beanstalk

[![CDK Version](https://img.shields.io/badge/CDK-v2.100.0+-blue.svg)](https://github.com/aws/aws-cdk)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE.txt)

## 🎯 Overview

This repository now includes **AWS CDK implementations** of the Blue-Green Deployment Quick Start for AWS Elastic Beanstalk. These implementations provide the same functionality as the original CloudFormation templates but use modern infrastructure-as-code practices with TypeScript and Python.

## 📚 Available Implementations

### Original CloudFormation (templates/)
- **Status**: ✅ Stable and Maintained
- **Language**: YAML
- **Use Case**: Traditional CloudFormation deployments
- **Documentation**: [README.md](README.md)

### AWS CDK TypeScript (cdk-typescript/)
- **Status**: ✅ Production Ready
- **Language**: TypeScript
- **Use Case**: Teams preferring TypeScript/JavaScript
- **Documentation**: [cdk-typescript/README.md](cdk-typescript/README.md)

### AWS CDK Python (cdk-python/)
- **Status**: ✅ Production Ready
- **Language**: Python
- **Use Case**: Teams preferring Python
- **Documentation**: [cdk-python/README.md](cdk-python/README.md)

## 🚀 Quick Start

### Prerequisites

- AWS Account
- AWS CLI configured
- Node.js 18+ (for TypeScript) or Python 3.8+ (for Python)
- AWS CDK CLI 2.100.0+

### Install CDK CLI

```bash
npm install -g aws-cdk
cdk --version
```

### Bootstrap Your AWS Account (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Deploy (Choose Your Language)

#### TypeScript
```bash
cd cdk-typescript
npm install
cdk deploy -c administratorEmail=your@email.com
```

#### Python
```bash
cd cdk-python
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate.bat
pip install -r requirements.txt
cdk deploy -c administratorEmail=your@email.com
```

#### CloudFormation (Original)
```bash
aws cloudformation create-stack \
  --stack-name BlueGreenDeployment \
  --template-body file://templates/bluegreen-deployment-master.template \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_IAM
```

## 📖 Documentation

### Getting Started Guides
- **[CDK Quick Start Guide](CDK_QUICK_START.md)** - 5-minute deployment guide
- **[CDK Conversion Guide](CDK_CONVERSION_GUIDE.md)** - Detailed conversion methodology
- **[Implementation Summary](CDK_IMPLEMENTATION_SUMMARY.md)** - Complete overview

### Implementation-Specific
- **[TypeScript README](cdk-typescript/README.md)** - TypeScript CDK details
- **[Python README](cdk-python/README.md)** - Python CDK details
- **[Original CloudFormation README](README.md)** - CloudFormation templates

## 🏗️ Architecture

### Pipeline Stages

The CDK implementations create a 7-stage CI/CD pipeline:

```
┌─────────────┐
│   Source    │ Pull application code and Lambda functions from S3
└──────┬──────┘
       │
┌──────▼──────┐
│   Lambda    │ Create Green environment (clone of Blue)
└──────┬──────┘
       │
┌──────▼──────┐
│   Manual    │ Wait for administrator approval
│  Approval   │
└──────┬──────┘
       │
┌──────▼──────┐
│  Swap URL   │ Route traffic from Blue to Green
└──────┬──────┘
       │
┌──────▼──────┐
│   Deploy    │ Deploy new version to Blue environment
└──────┬──────┘
       │
┌──────▼──────┐
│    Test     │ Run automated tests on Blue environment
└──────┬──────┘
       │
┌──────▼──────┐
│  Cleanup    │ Swap traffic back to Blue, terminate Green
└─────────────┘
```

### Cost Optimization

The Green environment only exists during deployment, significantly reducing costs:

- **Traditional Blue-Green**: 2× infrastructure cost (24/7)
- **This Implementation**: ~1.1× infrastructure cost (Green only during deployment)

## ✨ Features

### All Implementations Support

- ✅ Zero-downtime deployments
- ✅ Automated environment cloning
- ✅ Manual approval gates
- ✅ Automated testing
- ✅ Automatic rollback on failure
- ✅ Cost-optimized (temporary green environment)
- ✅ Email notifications
- ✅ CloudWatch monitoring
- ✅ S3 encryption
- ✅ IAM least privilege

### CDK-Specific Features

- ✅ Type safety (TypeScript)
- ✅ Unit testing support
- ✅ Easier customization
- ✅ Better IDE support
- ✅ Programmatic logic
- ✅ Hot reload with `cdk watch`
- ✅ Snapshot testing

## 🔄 Choosing an Implementation

### Choose CloudFormation If:
- You prefer YAML-based infrastructure
- You have existing CloudFormation expertise
- You need maximum compatibility
- You deploy via AWS Console

### Choose CDK TypeScript If:
- Your team uses JavaScript/TypeScript
- You want compile-time type checking
- You need extensive testing
- You prefer strong typing

### Choose CDK Python If:
- Your team uses Python
- You want simpler syntax
- You integrate with Python tools
- You prefer dynamic typing

## 📊 Feature Comparison

| Feature | CloudFormation | CDK TypeScript | CDK Python |
|---------|----------------|----------------|------------|
| Blue-Green Deployment | ✅ | ✅ | ✅ |
| Pipeline Automation | ✅ | ✅ | ✅ |
| Manual Approval | ✅ | ✅ | ✅ |
| Cost Optimization | ✅ | ✅ | ✅ |
| Type Safety | ❌ | ✅ | ⚠️ (with hints) |
| Unit Testing | ❌ | ✅ | ✅ |
| IDE Support | ⚠️ Basic | ✅ Excellent | ✅ Good |
| Learning Curve | Medium | Medium-High | Low-Medium |
| Code Reusability | ⚠️ Limited | ✅ High | ✅ High |
| Maintainability | ⚠️ Medium | ✅ High | ✅ High |

## 📦 What's Included

### CloudFormation Templates (templates/)
- `bluegreen-deployment-master.template` - Main orchestration template
- `codepipeline-stack.template` - Pipeline definition
- `elasticbeanstalk-sample.template` - Sample application
- `copyfunction-to-s3bucket.template` - Lambda asset management

### CDK TypeScript (cdk-typescript/)
- `bin/app.ts` - Application entry point
- `lib/bluegreen-deployment-stack.ts` - Main stack
- `lib/stacks/lambda-assets-stack.ts` - S3 and Lambda assets
- `lib/stacks/elasticbeanstalk-stack.ts` - Beanstalk resources
- `lib/stacks/codepipeline-stack.ts` - Pipeline definition

### CDK Python (cdk-python/)
- `app.py` - Application entry point
- `bluegreen_deployment/bluegreen_deployment_stack.py` - Main stack
- `bluegreen_deployment/stacks/lambda_assets_stack.py` - S3 and Lambda assets
- `bluegreen_deployment/stacks/elasticbeanstalk_stack.py` - Beanstalk resources
- `bluegreen_deployment/stacks/codepipeline_stack.py` - Pipeline definition

### Documentation
- `CDK_QUICK_START.md` - Quick deployment guide
- `CDK_CONVERSION_GUIDE.md` - Detailed conversion documentation
- `CDK_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `README_CDK.md` - This file

## 🔧 Configuration

### Required Parameters

Both CDK implementations require:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `administratorEmail` | Email for approval notifications | `admin@example.com` |
| `beanstalkSourceStageS3BucketKey` | S3 key for application source | `app-source.zip` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `existingBlueEnvironmentName` | (empty) | Use existing environment |
| `existingBeanstalkApplicationName` | (empty) | Use existing application |
| `greenEnvironmentName` | `GreenEnvironment` | Name for green environment |
| `nameofthePipeline` | `BlueGreenCICDPipeline` | Pipeline name |
| `qss3BucketName` | `aws-quickstart` | Quick Start bucket |
| `qss3KeyPrefix` | `quickstart-...` | S3 key prefix |

## 📈 Resource Creation

Each implementation creates:

- **1** CodePipeline with 7 stages
- **2** CodeBuild projects (URL swap and testing)
- **2** Lambda functions (create and terminate environment)
- **3** S3 buckets (artifacts, Lambda code, optional source)
- **1** SNS topic (approval notifications)
- **1** Optional Elastic Beanstalk application
- **1** Optional Elastic Beanstalk environment
- **Multiple** IAM roles and policies

**Total Resources**: 35-40 (depending on options)

## 💰 Cost Estimate

### Minimum Monthly Cost (t2.micro, minimal usage)
- CodePipeline: $1
- CodeBuild: $0.10
- Elastic Beanstalk (t2.micro): $15-20
- S3: $0.50
- Lambda: Free tier
- SNS: Free tier
- **Total**: ~$17-22/month

### With Active Deployments
- Add ~$5-10/month for additional CodeBuild minutes
- Scale with instance size and usage

## 🧪 Testing

### CloudFormation
- cfn-lint for syntax validation
- Manual integration testing

### CDK TypeScript
```bash
cd cdk-typescript
npm test
```

### CDK Python
```bash
cd cdk-python
pytest
```

## 🛠️ Customization

### Adding a Custom Pipeline Stage

**TypeScript:**
```typescript
{
  stageName: 'MyCustomStage',
  actions: [
    new codepipeline_actions.LambdaInvokeAction({
      actionName: 'MyAction',
      lambda: myFunction,
    }),
  ],
}
```

**Python:**
```python
{
    "stage_name": "MyCustomStage",
    "actions": [
        LambdaInvokeAction(
            action_name="MyAction",
            lambda_=my_function,
        ),
    ],
}
```

### Adding CloudWatch Alarms

**TypeScript:**
```typescript
new cloudwatch.Alarm(this, 'PipelineAlarm', {
  metric: pipeline.metricDuration(),
  threshold: 3600,
  evaluationPeriods: 1,
});
```

**Python:**
```python
cloudwatch.Alarm(
    self,
    "PipelineAlarm",
    metric=pipeline.metric_duration(),
    threshold=3600,
    evaluation_periods=1,
)
```

## 🔒 Security

All implementations follow AWS security best practices:

- ✅ S3 buckets encrypted at rest (S3-managed keys)
- ✅ SSL/TLS enforced for S3 access
- ✅ IAM roles use least privilege principle
- ✅ Secrets can be stored in AWS Secrets Manager
- ✅ Pipeline artifacts encrypted
- ✅ CloudWatch logs for audit trail

## 🆘 Troubleshooting

### Common Issues

**CDK Bootstrap Required**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**AWS Credentials Not Found**
```bash
aws configure
```

**Email Not Received**
- Check spam folder
- Confirm SNS subscription from email

**Pipeline Fails**
- Check CloudWatch Logs
- Verify IAM permissions
- Ensure S3 bucket has application code

### Getting Help

- 📖 [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- 💬 [AWS re:Post](https://repost.aws/)
- 🐛 [GitHub Issues](https://github.com/aws-quickstart/quickstart-codepipeline-bluegreen-deployment/issues)
- 📧 AWS Support

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

**TypeScript:**
```bash
cd cdk-typescript
npm install
npm run build
npm test
```

**Python:**
```bash
cd cdk-python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## 📝 License

This project is licensed under the Apache License 2.0 - see [LICENSE.txt](LICENSE.txt) for details.

## 🙏 Acknowledgments

- AWS Quick Start Team
- AWS CDK Team
- Contributors and maintainers
- Community feedback and testing

## 📮 Support

For support:
1. Check documentation in this repository
2. Review [AWS CDK documentation](https://docs.aws.amazon.com/cdk/)
3. Search [existing issues](https://github.com/aws-quickstart/quickstart-codepipeline-bluegreen-deployment/issues)
4. Open a new issue with details
5. Contact AWS Support for AWS-specific issues

## 🗺️ Roadmap

Future enhancements under consideration:

- [ ] ECS/Fargate support
- [ ] EKS blue-green deployments
- [ ] Multi-region deployments
- [ ] Advanced monitoring dashboards
- [ ] Automated rollback improvements
- [ ] Cost optimization recommendations
- [ ] Integration with AWS Proton
- [ ] GitOps workflow support

## 📊 Version History

- **v2.0** - Added CDK implementations (TypeScript and Python)
- **v1.0** - Original CloudFormation templates

---

## Quick Links

- 🚀 [Quick Start Guide](CDK_QUICK_START.md)
- 📚 [Conversion Guide](CDK_CONVERSION_GUIDE.md)
- 📊 [Implementation Summary](CDK_IMPLEMENTATION_SUMMARY.md)
- 💻 [TypeScript Docs](cdk-typescript/README.md)
- 🐍 [Python Docs](cdk-python/README.md)

---

**Ready to deploy?** Start with the [Quick Start Guide](CDK_QUICK_START.md)! 🎉
