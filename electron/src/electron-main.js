// @flow

/*
Copyright 2016 Aviral Dasgupta and OpenMarket Ltd

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
const url = require('url');

const VectorMenu = require('./vectormenu');

const PERMITTED_URL_SCHEMES = [
    'http:',
    'https:',
    'mailto:',
];

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;

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
    electron.autoUpdater.quitAndInstall();
}

function pollForUpdates() {
    try {
        electron.autoUpdater.checkForUpdates();
    } catch (e) {
        console.log("Couldn't check for update", e);
    }
}

electron.ipcMain.on('install_update', installUpdate);

electron.app.on('ready', () => {
    try {
        // For reasons best known to Squirrel, the way it checks for updates
        // is completely different between macOS and windows. On macOS, it
        // hits a URL that either gives it a 200 with some json or
        // 204 No Content. On windows it takes a base path and looks for
        // files under that path.
        if (process.platform == 'darwin') {
            electron.autoUpdater.setFeedURL("https://riot.im/autoupdate/desktop/");
        } else if (process.platform == 'win32') {
            electron.autoUpdater.setFeedURL("https://riot.im/download/desktop/win32/");
        } else {
            // Squirrel / electron only supports auto-update on these two platforms.
            // I'm not even going to try to guess which feed style they'd use if they
            // implemented it on Linux, or if it would be different again.
            console.log("Auto update not supported on this platform");
        }
        // We check for updates ourselves rather than using 'updater' because we need to
        // do it in the main process (and we don't really need to check every 10 minutes:
        // every hour should be just fine for a desktop app)
        // However, we still let the main window listen for the update events.
        pollForUpdates();
        setInterval(pollForUpdates, UPDATE_POLL_INTERVAL_MS);
    } catch (err) {
        // will fail if running in debug mode
        console.log("Couldn't enable update checking", err);
    }

    mainWindow = new electron.BrowserWindow({
        icon: `${__dirname}/../../vector/img/logo.png`,
        width: 1024, height: 768,
    });
    mainWindow.loadURL(`file://${__dirname}/../../vector/index.html`);
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
