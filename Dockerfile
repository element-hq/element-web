# Builder
FROM node:alpine as builder

COPY . /src

WORKDIR /src

RUN apk add --no-cache git \
 && npm install \
 && npm run build


# App
FROM nginx:latest

COPY --from=builder /src/webapp /app
COPY config.sample.json /app/config.json

RUN rm -rf /usr/share/nginx/html \
 && ln -s /app /usr/share/nginx/html
