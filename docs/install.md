# Installing Element Web

**Familiarise yourself with the [Important Security Notes](../README.md#important-security-notes) before starting, they apply to all installation methods.**

_Note: that for the security of your chats will need to serve Element over HTTPS.
Major browsers also do not allow you to use VoIP/video chats over HTTP, as WebRTC is only usable over HTTPS.
There are some exceptions like when using localhost, which is considered a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts) and thus allowed._

## Release tarball

1. Download the latest version from <https://github.com/element-hq/element-web/releases>
1. Untar the tarball on your web server
1. Move (or symlink) the `element-x.x.x` directory to an appropriate name
1. Configure the correct caching headers in your webserver (see below)
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it. See the [configuration docs](config.md) for details.
1. Enter the URL into your browser and log into Element!

Releases are signed using gpg and the OpenPGP standard,
and can be checked against the public key located at <https://packages.element.io/element-release-key.asc>.

## Debian package

Element Web is now also available as a Debian package for Debian and Ubuntu based systems.

```shell
sudo apt install -y wget apt-transport-https
sudo wget -O /usr/share/keyrings/element-io-archive-keyring.gpg https://packages.element.io/debian/element-io-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/element-io-archive-keyring.gpg] https://packages.element.io/debian/ default main" | sudo tee /etc/apt/sources.list.d/element-io.list
sudo apt update
sudo apt install element-web
```

Configure the app by modifying `/etc/element-web/config.json`. See the [configuration docs](config.md) for details.

Then point your chosen web server (e.g. Caddy, Nginx, Apache, etc) at the `/usr/share/element-web` webroot.

## Docker

The Docker image can be used to serve element-web as a web server. The easiest way to use
it is to use the prebuilt image:

```bash
docker run --rm -p 127.0.0.1:80:80 vectorim/element-web
```

A server can also be made available to clients outside the local host by omitting the
explicit local address as described in
[docker run documentation](https://docs.docker.com/engine/reference/commandline/run/#publish-or-expose-port--p---expose):

```bash
docker run --rm -p 80:80 vectorim/element-web
```

To supply your own custom `config.json`, map a volume to `/app/config.json`. For example,
if your custom config was located at `/etc/element-web/config.json` then your Docker command
would be:

```bash
docker run --rm -p 127.0.0.1:80:80 -v /etc/element-web/config.json:/app/config.json vectorim/element-web
```

The Docker image is configured to run as an unprivileged (non-root) user by
default. This should be fine on modern Docker runtimes, but binding to port 80
on other runtimes may require root privileges. To resolve this, either run the
image as root (`docker run --user 0`) or, better, change the port that nginx
listens on via the `ELEMENT_WEB_PORT` environment variable.

[Element Web Modules](https://github.com/element-hq/element-modules/tree/main/packages/element-web-module-api) can be dynamically loaded
by being made available (e.g. via bind mount) in a directory within `/modules/`.
The default entrypoint will be index.js in that directory but can be overridden if a package.json file is found with a `main` directive.
These modules will be presented in a `/modules` subdirectory within the webroot, and automatically added to the config.json `modules` field.

If you wish to use docker in read-only mode,
you should follow the [upstream instructions](https://hub.docker.com/_/nginx#:~:text=Running%20nginx%20in%20read%2Donly%20mode)
but additionally include the following directories:

- /tmp/
- /etc/nginx/conf.d/

The behaviour of the docker image can be customised via the following
environment variables:

- `ELEMENT_WEB_PORT`

    The port to listen on (within the docker container) for HTTP
    traffic. Defaults to `80`.

### Building the docker image

To build the image yourself:

```bash
git clone https://github.com/element-hq/element-web.git element-web
cd element-web
git checkout master
docker build .
```

If you're building a custom branch, or want to use the develop branch, check out the appropriate
element-web branch and then run:

```bash
docker build -t \
    --build-arg USE_CUSTOM_SDKS=true \
    --build-arg JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git" \
    --build-arg JS_SDK_BRANCH="develop" \
    .
```

## Kubernetes

The provided element-web docker image can also be run from within a Kubernetes cluster.
See the [Kubernetes example](kubernetes.md) for more details.
