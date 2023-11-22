// This is a JS script so that the directory is created in-process on Windows.
// If the script isn't run in-process, there's a risk of it racing or never running
// due to file associations in Windows.
// Sorry.

import * as fs from "node:fs";
import * as path from "node:path";
import { mkdirpSync } from "mkdirp";
import fetch from "node-fetch";
import { ProxyAgent } from "proxy-agent";

console.log("Making webapp directory");
mkdirpSync("webapp");

// curl -s https://meet.element.io/libs/external_api.min.js > ./webapp/jitsi_external_api.min.js
console.log("Downloading Jitsi script");
const fname = path.join("webapp", "jitsi_external_api.min.js");

fetch("https://meet.element.io/libs/external_api.min.js", {
    agent: new ProxyAgent(),
})
    .then((res) => {
        const stream = fs.createWriteStream(fname);
        return new Promise<void>((resolve, reject) => {
            res.body.pipe(stream);
            res.body.on("error", (err) => reject(err));
            res.body.on("finish", () => resolve());
        });
    })
    .then(() => console.log("Done with Jitsi download"));
