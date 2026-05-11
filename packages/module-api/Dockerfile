ARG ELEMENT_VERSION=latest@sha256:f4a81a24d49a9c5b97e02e77a3013ec799873e500e69041078a28be98e4f1280

FROM --platform=$BUILDPLATFORM node:lts-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS builder

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