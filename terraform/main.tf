terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

# Define variables for tags
variable "environment" {
  description = "Environment (Dev, Stage, Prod)"
  type        = string
  default     = "Dev"
  
  validation {
    condition     = contains(["Dev", "Stage", "Prod"], var.environment)
    error_message = "Environment must be one of: Dev, Stage, Prod"
  }
}

variable "github_token" {
  description = "GitHub token for accessing the container registry"
  type        = string
  sensitive   = true
}

variable "release_tag" {
  description = "Release tag to use for Docker image"
  type        = string
}

# AWS Provider configuration
provider "aws" {
  region = "eu-central-1"

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "web-client"
      ManagedBy   = "terraform"
    }
  }
}

# Get latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Use default VPC and subnet
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "default" {
  id = data.aws_subnets.default.ids[0]
}

# Security Group
resource "aws_security_group" "web" {
  name        = "voicedrop-web-client-${var.environment}-sg"
  description = "Security group for web client ${var.environment}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # In production, restrict to your IP
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "voicedrop-web-client-${var.environment}-sg"
  }
}

# Route53 Hosted Zone
resource "aws_route53_zone" "existing" {
  name = "voicedropdev.com"
}

# Route53 Record for web.voicedropdev.com
resource "aws_route53_record" "web" {
  zone_id = "Z09985382XFFHQY8KW9G7"
  name    = "web.voicedropdev.com"
  type    = "A"
  ttl     = 300
  
  # This will be dynamically set to the EC2 instance's public IP
  records = [aws_instance.web.public_ip]
}

# Use existing SSH Key Pair
data "aws_key_pair" "deployer" {
  key_name = "voicedrop-${lower(var.environment)}-deployer-key"
}

# EC2 Instance
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.medium"

  subnet_id                   = data.aws_subnet.default.id
  vpc_security_group_ids      = [aws_security_group.web.id]
  associate_public_ip_address = true

  key_name = data.aws_key_pair.deployer.key_name

  user_data = templatefile("${path.module}/user_data.sh", {
    github_token = var.github_token
    release_tag = var.release_tag
  })

  tags = {
    Name = "web-client-${var.environment}-instance"
  }
}
