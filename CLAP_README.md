# Clap Element Web

This is a customized version of Element Web for the Clap messenger platform.

## About

- **Base Version**: Element Web v1.12.2
- **Branch**: `clap-stable`
- **Homeserver**: dev.clap.ac (development), clap.ac (production)

## Quick Start

### Using Docker

```bash
docker build -t clap-element-web .
docker run -p 8080:80 clap-element-web
```

Visit http://localhost:8080

### Building from Source

```bash
# Install dependencies
yarn install

# Copy Clap config
cp config.clap.json config.json

# Start development server
yarn start
```

Visit http://localhost:8080

## Configuration

The Clap-specific configuration is in `config.clap.json`:

- **Homeserver**: https://dev.clap.ac
- **Brand**: Clap
- **Default Country**: KR
- **Labs Settings**: Enabled for testing

## Deployment

### Development (dev.clap.ac)

Automatically deployed via GitHub Actions on push to `clap-stable` branch.

### Production (clap.ac)

Manual deployment triggered via GitHub Actions with approval.

## Docker Image

Images are built and pushed to AWS ECR:

```
<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/clap-element-web:latest
<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/clap-element-web:<version>
```

## Infrastructure

Deployed using AWS services:
- **S3 + CloudFront**: Static hosting with CDN
- **ECS Fargate**: Container hosting (alternative)
- **ALB**: Load balancing

See `clap-infrastructure` repository for details.

## Customizations

1. **Branding**: Changed from "Element" to "Clap"
2. **Default Server**: Points to dev.clap.ac
3. **Region**: Optimized for Korean users (KR country code)
4. **Labs Features**: Enabled for development testing

## Updating Element Web

To update to a new Element Web version:

```bash
# Fetch latest tags
git fetch upstream --tags

# Merge new version into clap-stable
git checkout clap-stable
git merge v1.x.x

# Resolve conflicts if any
# Test thoroughly
# Push to trigger deployment
```

## License

This project inherits Element Web's licensing. See LICENSE files in the root directory.

## Related Repositories

- [clap-synapse](https://github.com/Clap-HQ/clap-synapse): Matrix Synapse homeserver
- [clap-infrastructure](https://github.com/Clap-HQ/clap-infrastructure): AWS infrastructure as code
- [ClapAndroid](https://github.com/Clap-HQ/ClapAndroid): Android client

## Support

For issues specific to Clap customizations, please open an issue in this repository.
For Element Web issues, please refer to the [upstream repository](https://github.com/element-hq/element-web).
