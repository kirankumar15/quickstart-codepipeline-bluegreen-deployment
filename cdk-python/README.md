# Blue-Green Deployment CDK - Python Implementation

## Overview

This directory contains the AWS CDK (Python) implementation of the Blue-Green Deployment Quick Start for AWS Elastic Beanstalk. It provides the same functionality as the TypeScript version but uses Python for infrastructure definition.

## Prerequisites

- Python 3.8 or later
- AWS CDK CLI 2.100.0 or later
- AWS CLI configured with appropriate credentials
- pip (Python package manager)

## Installation

### 1. Create and Activate Virtual Environment

**macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate.bat
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Verify Installation

```bash
python -c "import aws_cdk; print(aws_cdk.__version__)"
```

## Project Structure

```
cdk-python/
├── app.py                                      # CDK application entry point
├── bluegreen_deployment/
│   ├── __init__.py
│   ├── bluegreen_deployment_stack.py          # Main orchestrator stack
│   └── stacks/
│       ├── __init__.py
│       ├── lambda_assets_stack.py             # S3 and Lambda assets
│       ├── elasticbeanstalk_stack.py          # Beanstalk resources
│       └── codepipeline_stack.py              # Pipeline resources
├── cdk.json                                    # CDK configuration
├── requirements.txt                            # Python dependencies
├── requirements-dev.txt                        # Development dependencies
└── README.md                                   # This file
```

## Configuration

### Method 1: Context File (Recommended)

Create `cdk.context.json`:

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

### Method 2: Command-Line Context

```bash
cdk deploy \
  -c administratorEmail=your@email.com \
  -c beanstalkSourceStageS3BucketKey=app-source.zip
```

### Method 3: Environment Variables

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1
```

## Usage

### Synthesize CloudFormation Template

```bash
cdk synth
```

Output will be in `cdk.out/` directory.

### View Differences

```bash
cdk diff
```

### Deploy Stack

```bash
# With context file
cdk deploy

# With command-line context
cdk deploy -c administratorEmail=your@email.com

# Skip approval prompts (use with caution)
cdk deploy --require-approval never
```

### Destroy Stack

```bash
cdk destroy
```

## Configuration Parameters

### Required

- `administratorEmail`: Email for manual approval notifications
- `beanstalkSourceStageS3BucketKey`: S3 key for application source

### Optional - Elastic Beanstalk

- `beanstalkSourceStageS3BucketName`: Source bucket (empty = create new)
- `existingBlueEnvironmentName`: Existing environment (empty = create sample)
- `existingBeanstalkApplicationName`: Existing app (empty = create sample)
- `greenEnvironmentName`: Green environment name (default: "GreenEnvironment")

### Optional - Pipeline

- `nameofthePipeline`: Pipeline name (default: "BlueGreenCICDPipeline")

### Optional - Quick Start

- `qss3BucketName`: Quick Start bucket (default: "aws-quickstart")
- `qss3BucketRegion`: Bucket region (default: "us-east-1")
- `qss3KeyPrefix`: S3 key prefix for assets

## Development

### Install Development Dependencies

```bash
pip install -r requirements-dev.txt
```

### Code Formatting

```bash
# Format code
black bluegreen_deployment/

# Check formatting
black --check bluegreen_deployment/
```

### Linting

```bash
# Run flake8
flake8 bluegreen_deployment/

# Run mypy for type checking
mypy bluegreen_deployment/
```

### Running Tests

```bash
pytest
```

## Examples

### Example 1: Deploy with New Sample Environment

```bash
cdk deploy -c administratorEmail=admin@example.com
```

This creates:
- New Beanstalk application
- New blue environment with PHP sample app
- Complete CI/CD pipeline

### Example 2: Use Existing Beanstalk Environment

```bash
cdk deploy \
  -c administratorEmail=admin@example.com \
  -c existingBlueEnvironmentName=MyBlueEnv \
  -c existingBeanstalkApplicationName=MyApp \
  -c beanstalkSourceStageS3BucketKey=myapp/source.zip
```

### Example 3: Custom Pipeline Name

```bash
cdk deploy \
  -c administratorEmail=admin@example.com \
  -c nameofthePipeline=ProductionPipeline
```

### Example 4: Deploy to Specific Region

```bash
export CDK_DEFAULT_REGION=eu-west-1
cdk deploy -c administratorEmail=admin@example.com
```

## Python-Specific Features

### Type Hints

The Python implementation uses type hints for better code quality:

```python
def __init__(
    self,
    scope: Construct,
    construct_id: str,
    config: Dict[str, Any],
    **kwargs
) -> None:
    super().__init__(scope, construct_id, **kwargs)
```

### Pythonic Naming

Follows Python naming conventions:

```python
# snake_case for variables and functions
administrator_email = config["administrator_email"]

# PascalCase for classes
class BlueGreenDeploymentStack(Stack):
    pass
```

### Context Managers

Can be extended to use Python context managers:

```python
with open('config.json') as f:
    config = json.load(f)
```

## Troubleshooting

### Issue: ModuleNotFoundError

**Solution:**
```bash
# Ensure virtual environment is activated
source .venv/bin/activate  # or .venv\Scripts\activate.bat on Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: AWS Credentials Not Found

**Solution:**
```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

### Issue: CDK Bootstrap Required

**Solution:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Issue: Python Version Too Old

**Solution:**
```bash
# Install Python 3.8 or later
# On Ubuntu/Debian:
sudo apt-get install python3.9

# On macOS:
brew install python@3.9

# On Windows: Download from python.org
```

## Comparison with TypeScript Version

### Advantages of Python

1. **Familiar Syntax**: Easier for Python developers
2. **Rapid Development**: Less boilerplate code
3. **AWS SDK Integration**: Natural integration with boto3
4. **Data Processing**: Better for scripts that process data

### When to Choose Python

- Team primarily uses Python
- Integration with existing Python tools
- Preference for dynamic typing
- Simpler deployment scripts needed

### When to Choose TypeScript

- Need compile-time type checking
- Better IDE support required
- Larger CDK community
- JavaScript/TypeScript team expertise

## Best Practices

### 1. Use Virtual Environments

Always use virtual environments to isolate dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 2. Pin Dependencies

Specify exact versions in `requirements.txt`:

```
aws-cdk-lib==2.100.0
constructs==10.3.0
```

### 3. Use Type Hints

Add type hints for better code quality:

```python
from typing import Dict, Any, Optional

def create_bucket(name: str) -> Bucket:
    return Bucket(self, name)
```

### 4. Follow PEP 8

Use Python code style guidelines:

```bash
black bluegreen_deployment/
flake8 bluegreen_deployment/
```

### 5. Document Functions

Use docstrings:

```python
def create_pipeline(self, config: Dict[str, Any]) -> Pipeline:
    """
    Creates the CodePipeline for blue-green deployment.
    
    Args:
        config: Configuration dictionary with pipeline settings
        
    Returns:
        The created Pipeline construct
    """
```

## Integration with Other Tools

### Boto3 Integration

```python
import boto3

# Can mix CDK with boto3
s3 = boto3.client('s3')
# Use boto3 for runtime operations
```

### AWS Lambda Powertools

```python
from aws_lambda_powertools import Logger

logger = Logger()

# Use in Lambda functions
@logger.inject_lambda_context
def handler(event, context):
    logger.info("Processing event")
```

### Pandas for Data Processing

```python
import pandas as pd

# Process deployment logs
df = pd.read_csv('deployment-logs.csv')
df.groupby('status').count()
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy CDK Stack
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          cd cdk-python
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          cd cdk-python
          cdk deploy --require-approval never
```

### GitLab CI

```yaml
deploy:
  image: python:3.9
  script:
    - cd cdk-python
    - pip install -r requirements.txt
    - npm install -g aws-cdk
    - cdk deploy --require-approval never
  only:
    - main
```

## Monitoring and Logging

### Enable CDK Logs

```bash
export CDK_DEBUG=true
cdk deploy
```

### CloudWatch Logs

```python
from aws_cdk import aws_logs as logs

# Add to stack
log_group = logs.LogGroup(
    self,
    "DeploymentLogs",
    retention=logs.RetentionDays.ONE_WEEK
)
```

## Cost Optimization

### Use Tagging

```python
from aws_cdk import Tags

Tags.of(self).add("CostCenter", "Engineering")
Tags.of(self).add("Environment", "Production")
```

### Implement Lifecycle Policies

```python
from aws_cdk import Duration

bucket = Bucket(
    self,
    "Bucket",
    lifecycle_rules=[
        LifecycleRule(
            expiration=Duration.days(30),
            prefix="temp/"
        )
    ]
)
```

## Security

### Use Secrets Manager

```python
from aws_cdk import aws_secretsmanager as secretsmanager

secret = secretsmanager.Secret.from_secret_name_v2(
    self,
    "ApiSecret",
    "bluegreen/api-secret"
)
```

### Enable Encryption

```python
from aws_cdk.aws_s3 import BucketEncryption

bucket = Bucket(
    self,
    "SecureBucket",
    encryption=BucketEncryption.KMS,
    enforce_ssl=True
)
```

## Additional Resources

- [AWS CDK Python Workshop](https://cdkworkshop.com/30-python.html)
- [AWS CDK Python API Reference](https://docs.aws.amazon.com/cdk/api/v2/python/)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [PEP 8 Style Guide](https://www.python.org/dev/peps/pep-0008/)

## Contributing

To contribute to the Python implementation:

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and formatting
5. Submit a pull request

## License

Apache 2.0 - See LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Contact AWS Support
- Post on AWS re:Post

---

**Note**: This Python implementation is feature-equivalent to the TypeScript version. Choose based on your team's expertise and preferences.
