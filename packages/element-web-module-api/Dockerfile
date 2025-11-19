ARG ELEMENT_VERSION=latest@sha256:e2099ff363200f1e972a651170f7151c416acdbe3c1aa7715cd6c11f80ef1268

FROM --platform=$BUILDPLATFORM node:lts-alpine@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43 AS builder

ARG BUILD_CONTEXT

RUN apk add --no-cache jq

WORKDIR /app
COPY package.json yarn.lock ./
# Copy the package.json files of all modules & packages to ensure the frozen workspace lockfile holds up
RUN --mount=type=bind,target=/docker-context \
    cd /docker-context/; \
    find . -path ./node_modules -prune -o -name "package.json" -mindepth 0 -maxdepth 4 -exec cp --parents "{}" /app/ \;
RUN yarn install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY ./$BUILD_CONTEXT ./$BUILD_CONTEXT
RUN cd $BUILD_CONTEXT && yarn vite build
RUN mkdir /modules
RUN cp -r ./$BUILD_CONTEXT/lib/ /modules/$(jq -r '"\(.name)-v\(.version)"' ./$BUILD_CONTEXT/package.json)

FROM ghcr.io/element-hq/element-web:${ELEMENT_VERSION}

COPY --from=builder /modules /modules/