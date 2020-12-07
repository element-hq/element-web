# Update on docker hub with the following commands in the directory of this file:
# docker build -t vectorim/element-web-ci-e2etests-env:latest .
# docker log
# docker push vectorim/element-web-ci-e2etests-env:latest
FROM node:10
RUN apt-get update
RUN apt-get -y install build-essential python3-dev libffi-dev python-pip python-setuptools sqlite3 libssl-dev python-virtualenv libjpeg-dev libxslt1-dev uuid-runtime
# dependencies for chrome (installed by puppeteer)
RUN apt-get -y install gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
