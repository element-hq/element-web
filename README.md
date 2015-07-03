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

The above commands will let you start working on the app, and any changes you
make to the javascript source files will cause the javascript to be rebuilt
automatically, but the same will not apply for the CSS.

To have the CSS bundle also rebuild as you change it:

1. `cd matrix-react-sdk`
2. `npm run start:css`

Note that you may need to restart the CSS builder if you add a new file. Note
that `npm start` builds debug versions of the the javascript and CSS, which are
much larger than the production versions build by the `npm run build` commands.

