Vector/Web
==========

Vector is a Matrix web client built using the Matrix React SDK (https://github.com/matrix-org/matrix-react-sdk).

Getting started
===============

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
2. Clone the repo: `git clone https://github.com/vector-im/vector-web.git` 
3. Switch to the SDK directory: `cd vector-web`
4. Install the prerequisites: `npm install`
5. Start the development builder and a testing server: `npm start`
6. Wait a few seconds for the initial build to finish.
7. Open http://127.0.0.1:8080/ in your browser to see your newly built Vector.

With `npm start`, any changes you make to the source files will cause a rebuild so
your changes will show up when you refresh.

For production use, run `npm run build` to build all the necessary files
into the `vector` directory and run your own server.

Development
===========

For simple tweaks, you can work on any of the source files within Vector with the
setup above, and your changes will cause an instant rebuild.

However, all serious development on Vector happens on the `develop` branch.  This typically
depends on the `develop` snapshot versions of `matrix-react-sdk` and `matrix-js-sdk`
too, which isn't expressed in Vector's `package.json`.  To do this, check out
the `develop` branches of these libraries and then use `npm link` to tell Vector
about them:

1. `git clone git@github.com:matrix-org/matrix-react-sdk.git`
2. `cd matrix-react-sdk`
3. `git checkout develop`
4. `npm install`
5. `npm start` (to start the dev rebuilder)
6. `cd ../vector-web`
7. Link the react sdk package into the example:
   `npm link path/to/your/react/sdk`

Similarly, you may need to `npm link path/to/your/js/sdk` in your `matrix-react-sdk`
directory.

If you add or remove any components from the Vector skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

You may need to run `npm i source-map-loader` in matrix-js-sdk if you get errors
about "Cannot resolve module 'source-map-loader'" due to shortcomings in webpack.

Deployment
==========

Just run `npm build` and then mount the `vector` directory on your webserver to
actually serve up the app, which is entirely static content.

