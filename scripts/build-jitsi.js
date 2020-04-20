// This is a JS script so that the directory is created in-process on Windows.
// If the script isn't run in-process, there's a risk of it racing or never running
// due to file associations in Windows.
// Sorry.

const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const fetch = require("node-fetch");

console.log("Making webapp directory");
mkdirp.sync("webapp");

// curl -s https://jitsi.riot.im/libs/external_api.min.js > ./webapp/jitsi_external_api.min.js
console.log("Downloading Jitsi script");
const fname = path.join("webapp", "jitsi_external_api.min.js");
fetch("https://jitsi.riot.im/libs/external_api.min.js").then(res => {
   const stream = fs.createWriteStream(fname);
   return new Promise((resolve, reject) => {
       res.body.pipe(stream);
       res.body.on('error', err => reject(err));
       res.body.on('finish', () => resolve());
   });
}).then(() => console.log('Done with Jitsi download'));
