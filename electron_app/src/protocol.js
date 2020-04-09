/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const {app} = require("electron");
const crypto = require("crypto");

const PROTOCOL = "riot://";
const SEARCH_PARAM = "riot-desktop-args";

const processUrl = (url) => {
    if (!global.mainWindow) return;
    console.log("Handling link: ", url);
    global.mainWindow.loadURL(url.replace(PROTOCOL, "vector://"));
};

// we encrypt anything that we expose to be passed back to our callback protocol
// so that homeservers don't see our directory paths and have the ability to manipulate them.
const algorithm = "aes-192-cbc";

const getKeyIv = () => ({
    key: crypto.scryptSync(app.getPath("exe"), "salt", 24),
    iv: Buffer.alloc(16, 0),
});

const encrypt = (plaintext) => {
    const {key, iv} = getKeyIv();
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    return ciphertext;
};

const decrypt = (ciphertext) => {
    const {key, iv} = getKeyIv();
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let plaintext = decipher.update(ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");
    return plaintext;
};

module.exports = {
    getArgs: (argv) => {
        if (argv['profile-dir'] || argv['profile']) {
            return encrypt(app.getPath('userData'));
        }
    },
    getProfileFromDeeplink: (args) => {
        // check if we are passed a profile in the SSO callback url
        const deeplinkUrl = args.find(arg => arg.startsWith('riot://'));
        if (deeplinkUrl && deeplinkUrl.includes(SEARCH_PARAM)) {
            const parsedUrl = new URL(deeplinkUrl);
            if (parsedUrl.protocol === 'riot:') {
                const profile = parsedUrl.searchParams.get(SEARCH_PARAM);
                console.log("Forwarding to profile: ", profile);
                return decrypt(profile);
            }
        }
    },
    protocolInit: () => {
        // get all args except `hidden` as it'd mean the app would not get focused
        // XXX: passing args to protocol handlers only works on Windows, so unpackaged deep-linking
        // --profile/--profile-dir are passed via the SEARCH_PARAM var in the callback url
        const args = process.argv.slice(1).filter(arg => arg !== "--hidden" && arg !== "-hidden");
        if (app.isPackaged) {
            app.setAsDefaultProtocolClient('riot', process.execPath, args);
        } else if (process.platform === 'win32') { // on Mac/Linux this would just cause the electron binary to open
            // special handler for running without being packaged, e.g `electron .` by passing our app path to electron
            app.setAsDefaultProtocolClient('riot', process.execPath, [app.getAppPath(), ...args]);
        }

        if (process.platform === 'darwin') {
            // Protocol handler for macos
            app.on('open-url', function(ev, url) {
                ev.preventDefault();
                processUrl(url);
            });
        } else {
            // Protocol handler for win32/Linux
            app.on('second-instance', (ev, commandLine) => {
                const url = commandLine[commandLine.length - 1];
                if (!url.startsWith(PROTOCOL)) return;
                processUrl(url);
            });
        }
    },
};


