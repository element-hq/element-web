# Multistage Docker Build for aloha-talk-web
# https://docs.docker.com/develop/develop-images/multistage-build/#use-multi-stage-builds

FROM docker.io/node:carbon AS build

WORKDIR /aloha/build

COPY . .

RUN npm install

RUN npm run build

FROM docker.io/nginx:1.15-alpine AS install

# Use a build time arg to set target context: --build-arg context=<kubernetes context>
ARG context=minikube

WORKDIR /aloha/aloha-talk

COPY --from=build /aloha/build/devops/nginx/nginx.conf /etc/nginx/nginx.conf

COPY --from=build /aloha/build/webapp .

COPY --from=build /aloha/build/devops/contexts/${context}/config.localhost.json .
