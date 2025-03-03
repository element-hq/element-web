ARG ELEMENT_VERSION=latest

FROM --platform=$BUILDPLATFORM node:lts-alpine AS builder

ARG BUILD_CONTEXT

RUN apk add --no-cache jq

WORKDIR /app
COPY package.json yarn.lock ./
COPY ./$BUILD_CONTEXT/package.json ./$BUILD_CONTEXT/
RUN yarn install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY ./$BUILD_CONTEXT ./$BUILD_CONTEXT
RUN cd $BUILD_CONTEXT && yarn vite build
RUN mkdir /modules
RUN cp -r ./$BUILD_CONTEXT/lib/ /modules/$(jq -r '"\(.name)-v\(.version)"' ./$BUILD_CONTEXT/package.json)

FROM ghcr.io/element-hq/element-web:${ELEMENT_VERSION}

COPY --from=builder /modules /tmp/element-web-modules/