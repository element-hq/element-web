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

// Squirrel on windows starts the app with various flags
// as hooks to tell us when we've been installed/uninstalled
// etc.
const checkSquirrelHooks = require('./squirrelhooks');
if (checkSquirrelHooks()) return;

const electron = require('electron');
const url = require('url');

const tray = require('./tray');
const vectorMenu = require('./vectormenu');

const windowStateKeeper = require('electron-window-state');

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
const INITIAL_UPDATE_DELAY_MS = 30 * 1000;

let mainWindow = null;
let appQuitting = false;

function safeOpenURL(target) {
    // openExternal passes the target to open/start/xdg-open,
    // so put fairly stringent limits on what can be opened
    // (for instance, open /bin/sh does indeed open a terminal
    // with a shell, albeit with no arguments)
    const parsedUrl = url.parse(target);
    if (PERMITTED_URL_SCHEMES.indexOf(parsedUrl.protocol) > -1) {
        // explicitly use the URL re-assembled by the url library,
        // so we know the url parser has understood all the parts
        // of the input string
        const newTarget = url.format(parsedUrl);
        electron.shell.openExternal(newTarget);
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
    const popupMenu = new electron.Menu();

    popupMenu.append(new electron.MenuItem({
        label: params.linkURL,
        click() { safeOpenURL(params.linkURL); },
    }));

    popupMenu.append(new electron.MenuItem({
        label: 'Copy Link Address',
        click() { electron.clipboard.writeText(params.linkURL); },
    }));

    popupMenu.popup();
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
        console.log('Couldn\'t check for update', e);
    }
}

function startAutoUpdate(updateBaseUrl) {
    if (updateBaseUrl.slice(-1) !== '/') {
        updateBaseUrl = updateBaseUrl + '/';
    }
    try {
        // For reasons best known to Squirrel, the way it checks for updates
        // is completely different between macOS and windows. On macOS, it
        // hits a URL that either gives it a 200 with some json or
        // 204 No Content. On windows it takes a base path and looks for
        // files under that path.
        if (process.platform === 'darwin') {
            // include the current version in the URL we hit. Electron doesn't add
            // it anywhere (apart from the User-Agent) so it's up to us. We could
            // (and previously did) just use the User-Agent, but this doesn't
            // rely on NSURLConnection setting the User-Agent to what we expect,
            // and also acts as a convenient cache-buster to ensure that when the
            // app updates it always gets a fresh value to avoid update-looping.
            electron.autoUpdater.setFeedURL(
                `${updateBaseUrl}macos/?localVersion=${encodeURIComponent(electron.app.getVersion())}`);

        } else if (process.platform === 'win32') {
            electron.autoUpdater.setFeedURL(updateBaseUrl + 'win32/' + process.arch + '/');
        } else {
            // Squirrel / electron only supports auto-update on these two platforms.
            // I'm not even going to try to guess which feed style they'd use if they
            // implemented it on Linux, or if it would be different again.
            console.log('Auto update not supported on this platform');
        }
        // We check for updates ourselves rather than using 'updater' because we need to
        // do it in the main process (and we don't really need to check every 10 minutes:
        // every hour should be just fine for a desktop app)
        // However, we still let the main window listen for the update events.
        // We also wait a short time before checking for updates the first time because
        // of squirrel on windows and it taking a small amount of time to release a
        // lock file.
        setTimeout(pollForUpdates, INITIAL_UPDATE_DELAY_MS);
        setInterval(pollForUpdates, UPDATE_POLL_INTERVAL_MS);
    } catch (err) {
        // will fail if running in debug mode
        console.log('Couldn\'t enable update checking', err);
    }
}

// handle uncaught errors otherwise it displays
// stack traces in popup dialogs, which is terrible (which
// it will do any time the auto update poke fails, and there's
// no other way to catch this error).
// Assuming we generally run from the console when developing,
// this is far preferable.
process.on('uncaughtException', function(error) {
    console.log('Unhandled exception', error);
});

electron.ipcMain.on('install_update', installUpdate);

let focusHandlerAttached = false;
electron.ipcMain.on('setBadgeCount', function(ev, count) {
    electron.app.setBadgeCount(count);
    if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused()) {
        if (count > 0) {
            if (!focusHandlerAttached) {
                mainWindow.once('focus', () => {
                    mainWindow.flashFrame(false);
                    focusHandlerAttached = false;
                });
                focusHandlerAttached = true;
            }
            mainWindow.flashFrame(true);
        } else {
            mainWindow.flashFrame(false);
        }
    }
});

electron.app.commandLine.appendSwitch('--enable-usermedia-screen-capturing');

const shouldQuit = electron.app.makeSingleInstance((commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

if (shouldQuit) {
    console.log('Other instance detected: exiting');
    electron.app.quit();
}

electron.app.on('ready', () => {
    if (vectorConfig.update_base_url) {
        console.log(`Starting auto update with base URL: ${vectorConfig.update_base_url}`);
        startAutoUpdate(vectorConfig.update_base_url);
    } else {
        console.log('No update_base_url is defined: auto update is disabled');
    }

    const iconPath = `${__dirname}/../img/riot.${process.platform === 'win32' ? 'ico' : 'png'}`;

    // Load the previous window state with fallback to defaults
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1024,
        defaultHeight: 768,
    });

    mainWindow = new electron.BrowserWindow({
        icon: iconPath,
        show: false,
        autoHideMenuBar: true,

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
    });
    mainWindow.loadURL(`file://${__dirname}/../../webapp/index.html`);
    electron.Menu.setApplicationMenu(vectorMenu);

    // Create trayIcon icon
    tray.create(mainWindow, {
        icon_path: iconPath,
        brand: vectorConfig.brand || 'Riot',
    });

    if (!process.argv.includes('--hidden')) {
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.on('close', (e) => {
        if (!appQuitting && (tray.hasTray() || process.platform === 'darwin')) {
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

    mainWindowState.manage(mainWindow);
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

// Set the App User Model ID to match what the squirrel
// installer uses for the shortcut icon.
// This makes notifications work on windows 8.1 (and is
// a noop on other platforms).
electron.app.setAppUserModelId('com.squirrel.riot-web.Riot');
