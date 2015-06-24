matrix-react-sdk
================

This is a react-based SDK for inserting a Matrix chat client into a web page

Getting started with the example
================================

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
2. Clone the repo: `git clone https://github.com/matrix-org/matrix-react-sdk.git` 
3. Switch to your new checkout: `cd matrix-react-sdk`
4. Build the CSS: `npm install && npm run build:css`
5. Switch to the example: `cd example`
6. Build the javascript & copy the CSS:
   `npm install && npm run build && ln -s ../bundle.css ./`

Serve the app from within the `example` directory by running `python -m
SimpleHTTPServer 8000` and access it at
[http://127.0.0.1:8000](http://127.0.0.1:8000/)

Using the example app for development
=====================================

To develop using the example app, you can avoid havign to repeat the above
steps each time you change something:

1. Perform all the steps above
2. In the matrix-react-sdk directory: `npm run start:css`
3. Open a new terminal window in the matrix-react-sdk directory:
   `cd example; npm start`

Now, development version of your Javascript and CSS will be rebuilt whenever
you change any of the files (although you may need to restart the CSS builder
if you add a new file). Note that the debug CSS and Javascript are much, much
larger than the production versions.

