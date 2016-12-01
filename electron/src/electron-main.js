// @flow

/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

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

const electron = require('electron');

// Auto updater from the 'electron-auto-updater' package for NSIS
// auto-update support (not the one that comes with electron).
const autoUpdater = require('electron-auto-updater').autoUpdater;
const url = require('url');

const VectorMenu = require('./vectormenu');

let vectorConfig = {};
try {
    vectorConfig = require('../../webapp/config.json');
} catch (e) {
    // it would be nice to check the error code here and bail if the config
    // is unparseable, but we get MODULE_NOT_FOUND in the case of a missing
    // file or invalid json, so node is just very unhelpful.
    // Continue with the defaults (ie. an empty config)
}

const PERMITTED_URL_SCHEMES = [
    'http:',
    'https:',
    'mailto:',
];

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 5 * 1000;

let mainWindow = null;
let appQuitting = false;

function safeOpenURL(target) {
    // openExternal passes the target to open/start/xdg-open,
    // so put fairly stringent limits on what can be opened
    // (for instance, open /bin/sh does indeed open a terminal
    // with a shell, albeit with no arguments)
    const parsed_url = url.parse(target);
    if (PERMITTED_URL_SCHEMES.indexOf(parsed_url.protocol) > -1) {
        // explicitly use the URL re-assembled by the url library,
        // so we know the url parser has understood all the parts
        // of the input string
        const new_target = url.format(parsed_url);
        electron.shell.openExternal(new_target);
    }
}

function onWindowOrNavigate(ev, target) {
    // always prevent the default: if something goes wrong,
    // we don't want to end up opening it in the electron
    // app, as we could end up opening any sort of random
    // url in a window that has node scripting access.
    ev.preventDefault();
    safeOpenURL(target);
}

function onLinkContextMenu(ev, params) {
    const popup_menu = new electron.Menu();
    popup_menu.append(new electron.MenuItem({
        label: params.linkURL,
        click() {
            safeOpenURL(params.linkURL);
        },
    }));
    popup_menu.popup();
    ev.preventDefault();
}

function installUpdate() {
    // for some reason, quitAndInstall does not fire the
    // before-quit event, so we need to set the flag here.
    appQuitting = true;
    autoUpdater.quitAndInstall();
}

function pollForUpdates() {
    try {
        autoUpdater.checkForUpdates();
    } catch (e) {
        console.log("Couldn't check for update", e);
    }
}

function startAutoUpdate(update_url) {
    if (update_url.slice(-1) !== '/') {
        update_url = update_url + '/';
    }
    try {
        // Since writing, the electron auto update process has changed from being
        // completely different between platforms to being differently completely
        // different. On Mac, we set the feed URL here. On Windows, it uses a
        // yaml file bundled at build time from the 'publish' entry in the
        // package.json. There is no autoupdate for Linux: it's expected that
        // the distro will provide it.
        if (process.platform == 'darwin') {
            autoUpdater.setFeedURL(update_url + 'macos/');
        }
        // We check for updates ourselves rather than using 'updater' because we need to
        // do it in the main process (and we don't really need to check every 10 minutes:
        // every hour should be just fine for a desktop app)
        // However, we still let the main window listen for the update events.
        setTimeout(pollForUpdates, INITIAL_UPDATE_DELAY_MS);
        setInterval(pollForUpdates, UPDATE_POLL_INTERVAL_MS);
    } catch (err) {
        // will fail if running in debug mode
        console.log("Couldn't enable update checking", err);
    }
}

// handle uncaught errors otherwise it displays
// stack traces in popup dialogs, which is terrible (which
// it will do any time the auto update poke fails, and there's
// no other way to catch this error).
// Assuming we generally run from the console when developing,
// this is far preferable.
process.on('uncaughtException', function (error) {
    console.log("Unhandled exception", error);
});

electron.ipcMain.on('install_update', installUpdate);

electron.app.on('ready', () => {
    if (vectorConfig.update_url) {
        console.log("Starting auto update with URL: " + vectorConfig.update_url);
        startAutoUpdate(vectorConfig.update_url);
    } else {
        console.log("No update_url is defined: auto update is disabled");
    }

    mainWindow = new electron.BrowserWindow({
        icon: `${__dirname}/../img/riot.ico`,
        width: 1024, height: 768,
    });
    mainWindow.loadURL(`file://${__dirname}/../../webapp/index.html`);
    electron.Menu.setApplicationMenu(VectorMenu);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.on('close', (e) => {
        if (process.platform == 'darwin' && !appQuitting) {
            // On Mac, closing the window just hides it
            // (this is generally how single-window Mac apps
            // behave, eg. Mail.app)
            e.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.webContents.on('new-window', onWindowOrNavigate);
    mainWindow.webContents.on('will-navigate', onWindowOrNavigate);

    mainWindow.webContents.on('context-menu', function(ev, params) {
        if (params.linkURL) {
            onLinkContextMenu(ev, params);
        }
    });
});

electron.app.on('window-all-closed', () => {
    electron.app.quit();
});

electron.app.on('activate', () => {
    mainWindow.show();
});

electron.app.on('before-quit', () => {
    appQuitting = true;
});
