#!/bin/bash
# Build script for Clap Element Web Docker image

set -e

VERSION=${1:-latest}
IMAGE_NAME=${2:-clap-element-web}

echo "Building Clap Element Web Docker image..."
echo "Version: $VERSION"
echo "Image name: $IMAGE_NAME"

# Build the Docker image
docker build -t "$IMAGE_NAME:$VERSION" -f Dockerfile .

echo "✓ Docker image built successfully: $IMAGE_NAME:$VERSION"

# Optional: Run the image locally
if [ "$3" = "--run" ]; then
    echo "Starting container on port 8080..."
    docker run -d -p 8080:80 --name clap-element-web "$IMAGE_NAME:$VERSION"
    echo "✓ Container started. Access at http://localhost:8080"
fi
