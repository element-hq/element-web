Installation for vector on a home server setup on the develop branch
====================================================================

Install or update `node.js` so that your `npm` is at least at version `2.0.0`

Follow those steps:

```
mkdir ~/matrix

cd ~/matrix
git clone https://github.com/matrix-org/matrix-react-sdk.git
cd matrix-react-sdk
git checkout develop
npm install
npm run build
npm link

cd ~/matrix
git clone https://github.com/vector-im/vector-web.git
cd vector-web
git checkout develop
npm install
npm link matrix-react-sdk
npm run build
```
What happens here is that npm link on its own will look for a package.json file to find the name of the dep (matrix-react-sdk) and then create a symlink in the global node deps pointing to the directory you ran npm link in.

matrix-js-sdk and matrix-js-sdk should be fetched automatically from the develop branch version.

Deployment with apache configuration
====================================

Configure the app by modifying the `config.json` file to the correct values:

1. default_hs_url is for the home server url (could be http://your.server.ip:8008 if vector and synapse are on the same machine),
2. default_is_url is the default server used for verifying third party identifiers like email addresses. If this is blank, registering with an email address or adding an email address to your account will not work

Mount the `vector` directory on your webserver to actually serve up the app, which is entirely static content.

If you want to expose your service outside, don't forget to open the port in your firewall / box

See the sample of apache vhost configuration in the README:

You can add a reverse proxy if you do not want to expose your server on a new port.

```
$ sudo a2enmod proxy
$ sudo a2enmod proxy_http
```

And add this to inside your apache vhost:

```
ProxyRequests Off
ProxyPreservehost on
ServerName  your.server.name
ServerAlias www.your.server.name                         # optional
ProxyPass /_matrix http://127.0.0.1:8448/_matrix         # do not add a slash after the port number
ProxyPassReverse /matrix http://127.0.0.1:8448/_matrix   # do not add a slash after the port number
```

And reload apache.

You can now configure vector like this and rebuild it:

1. default_hs_url: http://your.server.name,
2. default_is_url: https://vector.im (but could be empty)