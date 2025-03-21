#!/bin/bash -xe
# Set up logging
LOG_FILE="/var/log/user-data.log"
touch $LOG_FILE
chmod 666 $LOG_FILE
exec 1>>$LOG_FILE 2>&1

log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')]: $1"
}

log_section() {
    echo ""
    echo "================================================================"
    log "$1" 
    echo "================================================================"
}

log_section "Starting Instance Configuration"
log "Script initiated with user data execution"

# System Updates
log_section "System Updates"
log "Updating system packages"
yum update -y

# Configure locale
log "Configuring system locale"
localedef -i en_US -f UTF-8 en_US.UTF-8
echo 'LANG=en_US.UTF-8' > /etc/locale.conf
echo 'LC_CTYPE=en_US.UTF-8' >> /etc/locale.conf
source /etc/locale.conf

log "System update and locale configuration completed" 

# Docker Installation
log_section "Docker Setup"
log "Installing Docker"
amazon-linux-extras install docker -y
log "Starting Docker service"
systemctl start docker
systemctl enable docker
log "Adding ec2-user to docker group"
usermod -a -G docker ec2-user
log "Docker installation completed" 

# Set github_token variable
github_token=${github_token}

# Set release_tag variable
release_tag=${release_tag}

# Docker Registry Login
log_section "Docker Registry Authentication"
log "Logging into GitHub Container Registry"
echo "${github_token}" | docker login ghcr.io -u voyzme --password-stdin

# Pull and Run Docker Image
log_section "Docker Image Deployment"
log "Pulling Docker image with tag: ${release_tag}"
docker pull ghcr.io/voyzme/web-client/voicedrop-web:${release_tag}
log "Running Docker container"
docker run -d --name web-app -p 443:443 ghcr.io/voyzme/web-client/voicedrop-web:${release_tag}

log "Instance configuration completed successfully"
