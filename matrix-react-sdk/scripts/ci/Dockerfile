# Update on docker hub with the following commands in the directory of this file:
# If you're on linux amd64
#   docker build -t vectorim/element-web-ci-e2etests-env:latest .
# If you're on some other platform, you need to cross-compile
#   docker buildx build --platform linux/amd64,linux/arm64 --push -t vectorim/element-web-ci-e2etests-env:latest .
# Then:
#   docker push vectorim/element-web-ci-e2etests-env:latest
FROM node:14-buster
RUN apt-get update
RUN apt-get -y install \
    build-essential \
    jq \
    libffi-dev \
    libjpeg-dev \
    libssl-dev \
    libxslt1-dev \
    python3-dev \
    python-pip \
    python-setuptools \
    python-virtualenv \
    sqlite3 \
    uuid-runtime

# dependencies for chrome (installed by puppeteer)
RUN apt-get -y install \
    ca-certificates \
    fonts-liberation \
    gconf-service \
    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm-dev \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

RUN npm install -g typescript
