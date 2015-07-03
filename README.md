matrix-react-sdk
================

This is a react-based SDK for inserting a Matrix chat client into a web page

Getting started with the trivial example
========================================

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
2. Clone the repo: `git clone https://github.com/matrix-org/matrix-react-sdk.git` 
3. Switch to the example directory: `cd matrix-react-sdk/examples/trivial`
4. Install the prerequisites: `npm install`
5. Build the example and start a server: `npm start`

Now open http://127.0.0.1:8080/ in your browser to see your newly built
Matrix client.

Using the example app for development
=====================================

To work on the CSS and Javascript and have the bundle files update as you
change the source files, you'll need to do two extra things:

1. Link the react sdk package into the example:
   `cd matrix-react-sdk/example; npm link ..`
2. Start a watcher for the CSS files:
   `cd matrix-react-sdk; npm run start:css`

Note that you may need to restart the CSS builder if you add a new file. Note
that `npm start` builds debug versions of the the javascript and CSS, which are
much larger than the production versions build by the `npm run build` commands.

