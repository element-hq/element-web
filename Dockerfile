# Builder
FROM node:alpine as builder

RUN apk add --no-cache git

WORKDIR /src

COPY package.json /src/package.json
RUN npm install

COPY . /src
RUN npm run build


# App
FROM nginx:latest

COPY --from=builder /src/webapp /app
COPY config.sample.json /app/config.json

RUN rm -rf /usr/share/nginx/html \
 && ln -s /app /usr/share/nginx/html
