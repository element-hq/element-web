# Builder
FROM node:10-alpine as builder

# Support custom branches of the react-sdk and js-sdk. This also helps us build
# images of riot-web develop.
ARG USE_CUSTOM_SDKS=false
ARG REACT_SDK_REPO="https://github.com/matrix-org/matrix-react-sdk.git"
ARG REACT_SDK_BRANCH="master"
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

RUN apk add --no-cache git dos2unix

WORKDIR /src

COPY . /src
RUN dos2unix /src/scripts/docker-link-repos.sh && sh /src/scripts/docker-link-repos.sh
RUN yarn --network-timeout=100000 install
RUN yarn build

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/config.sample.json /src/webapp/config.json


# App
FROM nginx:latest

COPY --from=builder /src/webapp /app

RUN rm -rf /usr/share/nginx/html \
 && ln -s /app /usr/share/nginx/html
