matrix-react-sdk
================

This is a react-based SDK for inserting a Matrix chat client into a web page

1. Install or update `node.js so that your `npm` is at least at version `2.3.0`
2. Clone the repo `git clone https://github.com/matrix-org/matrix-react-sdk.git` 
3. Navigate to example folder and install dependencies `cd example; npm install`
4. Go back to root folder and build CSS `cd ..; npm install; npm run start:css`
5. Copy builds `cd example; cp../bundle.css ./; npm start`

Serve the app from within the `example` directory by running `python -m SimpleHTTPServer 8000` and access it at [http://0.0.0.0:8000](http://0.0.0.0:8000/)