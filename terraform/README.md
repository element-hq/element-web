# Web Client Deployment Guide

This directory contains Terraform configuration to deploy the web client application to AWS EC2 in eu-central-1.

## Prerequisites

1. [Terraform](https://www.terraform.io/downloads.html) installed (v1.0.0+)
2. AWS credentials configured (`aws configure` or environment variables)
3. SSH key pair at `~/.ssh/id_rsa.pub` (create one using `ssh-keygen` if needed)

## Environment Support

The deployment supports three environments:
- Dev (default)
- Stage
- Prod

The environment is automatically validated and used for resource tagging.

## Deployment Steps

1. Initialize Terraform:
```bash
terraform init
```

2. Review the deployment plan:
```bash
terraform plan
```

3. Apply the configuration (optionally specify environment):
```bash
# Deploy to Dev (default)
terraform apply

# Or deploy to a specific environment
terraform apply -var="environment=Prod"
```

4. After successful deployment, Terraform will output:
- Instance public IP
- Application URL (http://<public-ip>:8080)
- SSH command to connect to the instance

## Infrastructure Details

- VPC with public subnet in eu-central-1
- Security group allowing inbound traffic on ports 8080 (application) and 22 (SSH)
- t2.micro EC2 instance running latest Amazon Linux 2023
- Automated application deployment using user data script
- Local SSH key pair automatically imported to AWS
- Resources tagged with environment name
- Latest Amazon Linux 2023 AMI automatically selected

## Cleanup

To destroy all created resources:
```bash
terraform destroy
```

## Security Notes

- The security group allows SSH access from any IP (0.0.0.0/0). For production, restrict this to your IP range.
- Consider using AWS Systems Manager Session Manager instead of SSH for production environments.
- AMI is automatically updated to the latest Amazon Linux 2023 version for security.
