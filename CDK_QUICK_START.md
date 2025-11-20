# CDK Quick Start Guide - Blue-Green Deployment

## Quick Deployment (5 Minutes)

### Prerequisites Check
```bash
# Check Node.js version (required for TypeScript)
node --version  # Should be >= 18.x

# Check Python version (required for Python CDK)
python --version  # Should be >= 3.8

# Check AWS CDK CLI
cdk --version  # Should be >= 2.100.0

# If CDK is not installed:
npm install -g aws-cdk

# Check AWS credentials
aws sts get-caller-identity
```

## Option 1: TypeScript Deployment

### Step 1: Navigate and Install
```bash
cd cdk-typescript
npm install
```

### Step 2: Configure (Choose One)

#### A. Create cdk.context.json (Recommended for Multiple Deploys)
```bash
cat > cdk.context.json << 'EOF'
{
  "administratorEmail": "your.email@example.com",
  "beanstalkSourceStageS3BucketKey": "app-source.zip",
  "nameofthePipeline": "MyBlueGreenPipeline"
}
EOF
```

#### B. Use Command-Line Context (Quick Test)
```bash
# Set your email
export ADMIN_EMAIL="your.email@example.com"
```

### Step 3: Bootstrap (First Time Only)
```bash
cdk bootstrap
```

### Step 4: Review Changes
```bash
# See what will be created
cdk synth

# Or compare with existing stack
cdk diff
```

### Step 5: Deploy
```bash
# Using cdk.context.json
cdk deploy

# Or using command-line context
cdk deploy --context administratorEmail=$ADMIN_EMAIL
```

### Step 6: Confirm and Wait
- Type 'y' when prompted
- Wait 15-20 minutes for deployment
- Check your email for SNS subscription confirmation

## Option 2: Python Deployment

### Step 1: Navigate and Install
```bash
cd cdk-python

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure
```bash
# Create cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "administratorEmail": "your.email@example.com",
  "beanstalkSourceStageS3BucketKey": "app-source.zip"
}
EOF
```

### Step 3: Bootstrap (First Time Only)
```bash
cdk bootstrap
```

### Step 4: Deploy
```bash
cdk deploy
```

## Post-Deployment Steps

### 1. Confirm SNS Subscription
Check your email for "AWS Notification - Subscription Confirmation" and click the confirmation link.

### 2. Get Stack Outputs
```bash
# List all outputs
aws cloudformation describe-stacks \
  --stack-name BlueGreenDeploymentStack \
  --query 'Stacks[0].Outputs' \
  --output table
```

Expected outputs:
- `CodePipelineName`: Name of the created pipeline
- `BlueEnvironmentName`: Name of the blue environment
- `GreenEnvironmentName`: Name of the green environment  
- `BeanstalkSourceBucketName`: S3 bucket for app uploads
- `NewBeanstalkEnvEndPointUrl`: URL of the Beanstalk environment

### 3. Upload Application Code
```bash
# Get the source bucket name
SOURCE_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name BlueGreenDeploymentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BeanstalkSourceBucketName`].OutputValue' \
  --output text)

# Upload your application zip file
aws s3 cp your-app.zip s3://$SOURCE_BUCKET/app-source.zip
```

### 4. Monitor Pipeline
```bash
# Get pipeline name
PIPELINE_NAME=$(aws cloudformation describe-stacks \
  --stack-name BlueGreenDeploymentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CodePipelineName`].OutputValue' \
  --output text)

# Watch pipeline execution
aws codepipeline get-pipeline-state --name $PIPELINE_NAME
```

Or visit AWS Console:
```
https://console.aws.amazon.com/codesuite/codepipeline/pipelines
```

## Common Deployment Scenarios

### Scenario 1: Deploy with Existing Beanstalk Environment

```bash
cdk deploy \
  --context administratorEmail=your@email.com \
  --context existingBlueEnvironmentName=MyExistingEnv \
  --context existingBeanstalkApplicationName=MyApp \
  --context beanstalkSourceStageS3BucketKey=myapp/source.zip
```

### Scenario 2: Deploy with Custom Pipeline Name

```bash
cdk deploy \
  --context administratorEmail=your@email.com \
  --context nameofthePipeline=MyCustomPipeline
```

### Scenario 3: Deploy with Existing S3 Bucket

```bash
cdk deploy \
  --context administratorEmail=your@email.com \
  --context beanstalkSourceStageS3BucketName=my-existing-bucket \
  --context beanstalkSourceStageS3BucketKey=app/source.zip
```

### Scenario 4: Deploy to Specific Region

```bash
# Set AWS region
export CDK_DEFAULT_REGION=us-west-2
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cdk deploy --context administratorEmail=your@email.com
```

## Testing the Deployment

### Test 1: Verify Pipeline Exists
```bash
aws codepipeline list-pipelines
```

### Test 2: Verify Beanstalk Environment
```bash
aws elasticbeanstalk describe-environments \
  --query 'Environments[?ApplicationName==`BlueGreenBeanstalkApplication`]'
```

### Test 3: Access Beanstalk Application
```bash
# Get endpoint URL
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name BlueGreenDeploymentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`NewBeanstalkEnvEndPointUrl`].OutputValue' \
  --output text)

# Test the endpoint
curl $ENDPOINT
```

### Test 4: Trigger Pipeline
```bash
# Upload a new version to trigger the pipeline
aws s3 cp your-app-v2.zip s3://$SOURCE_BUCKET/app-source.zip

# Monitor pipeline execution
watch -n 5 'aws codepipeline get-pipeline-state --name $PIPELINE_NAME | grep -A 3 "stageName"'
```

## Troubleshooting Quick Fixes

### Issue: "Unable to resolve AWS account"
```bash
# Configure AWS credentials
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

### Issue: "Need to perform AWS calls for account"
```bash
# Bootstrap your account
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Issue: "Resource already exists"
```bash
# Use a different stack name
cdk deploy --stack-name BlueGreenDeploymentStack2
```

### Issue: NPM install fails (TypeScript)
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Pip install fails (Python)
```bash
# Upgrade pip
pip install --upgrade pip

# Install with no cache
pip install --no-cache-dir -r requirements.txt
```

## Cleanup

### Complete Cleanup
```bash
# Destroy the stack
cdk destroy

# Confirm deletion
# Type 'y' when prompted
```

### Partial Cleanup (Keep Some Resources)

#### Keep S3 Buckets
Before destroying, modify the stack:

**TypeScript:**
```typescript
// Change in lambda-assets-stack.ts
removalPolicy: RemovalPolicy.RETAIN,
autoDeleteObjects: false,
```

**Python:**
```python
# Change in lambda_assets_stack.py
removal_policy=RemovalPolicy.RETAIN,
auto_delete_objects=False,
```

Then deploy and destroy:
```bash
cdk deploy
cdk destroy
```

### Manual Resource Cleanup
If `cdk destroy` fails:

```bash
# Delete stack manually
aws cloudformation delete-stack --stack-name BlueGreenDeploymentStack

# Empty S3 buckets manually if needed
aws s3 rm s3://bucket-name --recursive

# Delete the buckets
aws s3 rb s3://bucket-name --force
```

## Cost Estimation

### Minimum Cost (Sample Environment)
- CodePipeline: ~$1/month
- CodeBuild: ~$0.10/month (minimal use)
- Elastic Beanstalk: ~$15-20/month (t2.micro)
- S3: ~$0.50/month
- Lambda: Free tier
- **Total: ~$17-22/month**

### With Active Deployments
- Add ~$5-10/month for additional CodeBuild minutes
- Elastic Beanstalk costs increase with instance size

### Cost Optimization Tips
1. Use t3.micro instead of t2.micro (cheaper)
2. Enable auto-scaling to scale to zero during off-hours
3. Use spot instances for non-production
4. Clean up old pipeline artifacts regularly

## Next Steps

1. **Customize the Pipeline**: Edit `codepipeline-stack.ts/.py` to add more stages
2. **Add Tests**: Implement automated tests in the test stage
3. **Configure Monitoring**: Add CloudWatch alarms and dashboards
4. **Set Up Notifications**: Add Slack/Teams integration to SNS
5. **Implement Rollback**: Add automatic rollback on test failures

## Advanced Configuration

### Use Parameter Store for Sensitive Data
```bash
# Store email in Parameter Store
aws ssm put-parameter \
  --name "/bluegreen/admin-email" \
  --value "your@email.com" \
  --type String

# Reference in CDK
const email = ssm.StringParameter.valueFromLookup(this, '/bluegreen/admin-email');
```

### Multi-Environment Deployment
```typescript
// Define environments
const environments = {
  dev: { account: '111111111111', region: 'us-east-1' },
  prod: { account: '222222222222', region: 'us-west-2' }
};

// Deploy to dev
cdk deploy --context env=dev

// Deploy to prod
cdk deploy --context env=prod
```

### CI/CD for CDK
```yaml
# .github/workflows/deploy.yml
name: Deploy CDK Stack
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd cdk-typescript
          npm install
      - name: Deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          cd cdk-typescript
          cdk deploy --require-approval never
```

## Getting Help

### Documentation
- [CDK TypeScript API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [CDK Python API Reference](https://docs.aws.amazon.com/cdk/api/v2/python/)
- [Elastic Beanstalk Developer Guide](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/)

### Community Support
- [AWS CDK GitHub Issues](https://github.com/aws/aws-cdk/issues)
- [AWS re:Post](https://repost.aws/)
- [Stack Overflow - aws-cdk tag](https://stackoverflow.com/questions/tagged/aws-cdk)

### AWS Support
- Open a support case in AWS Console
- Contact your AWS Solutions Architect
- Use AWS Professional Services for implementation help

## Quick Reference Commands

```bash
# CDK Commands
cdk init app --language=typescript  # Initialize new TypeScript project
cdk init app --language=python      # Initialize new Python project
cdk synth                            # Synthesize CloudFormation template
cdk diff                             # Show differences
cdk deploy                           # Deploy stack
cdk destroy                          # Delete stack
cdk ls                               # List all stacks
cdk docs                             # Open CDK documentation

# AWS CLI Commands
aws codepipeline list-pipelines                      # List pipelines
aws elasticbeanstalk describe-environments           # List environments
aws s3 ls                                            # List S3 buckets
aws cloudformation describe-stacks                   # List stacks
aws logs tail /aws/lambda/function-name --follow     # Tail logs

# Useful Aliases (add to ~/.bashrc or ~/.zshrc)
alias cdkd='cdk deploy --require-approval never'
alias cdkw='cdk watch'
alias cdks='cdk synth'
```

## Success Checklist

- [ ] AWS CLI configured with valid credentials
- [ ] CDK CLI installed (version >= 2.100.0)
- [ ] Node.js/Python installed
- [ ] Account bootstrapped with CDK
- [ ] Email configured for notifications
- [ ] Stack deployed successfully
- [ ] SNS subscription confirmed
- [ ] Stack outputs retrieved
- [ ] Test application uploaded
- [ ] Pipeline execution verified
- [ ] Beanstalk environment accessible
- [ ] Blue-green deployment tested

You're now ready to use the Blue-Green Deployment pipeline! 🎉
