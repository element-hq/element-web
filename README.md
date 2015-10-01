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

Wiht `npm start`, Any changes you make to the source files will cause a rebuild so
your changes will show up when you refresh.

For production use, run `npm run build` to build all the necessary files
into the `vector` directory and run your own server.

Development
===========
You can work on any of the source files within Vector with the setup above,
and your changes will cause an instant rebuild. If you also need to make
changes to the react sdk, you can:

1. Link the react sdk package into the example:
   `npm link path/to/your/react/sdk`
2. Start the development rebuilder in your react SDK directory:
   `npm start`

If you add or remove any components from the Vector skin, you will need to rebuild
the skin's index by running, `npm run reskindex`.

Deployment
==========

Just run `npm build` and then mount the `vector` directory on your webserver to
actually serve up the app, which is entirely static content.

