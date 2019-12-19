/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2017, 2019 Michael Telatynski <7t3chguy@gmail.com>

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

const argv = require('minimist')(process.argv, {
    alias: {help: "h"},
});

const {app, ipcMain, powerSaveBlocker, BrowserWindow, Menu, autoUpdater, protocol} = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');

const tray = require('./tray');
const vectorMenu = require('./vectormenu');
const webContentsHandler = require('./webcontents-handler');
const updater = require('./updater');

const windowStateKeeper = require('electron-window-state');
const Store = require('electron-store');

const fs = require('fs');
const afs = fs.promises;

let Seshat = null;

try {
    Seshat = require('matrix-seshat');
} catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
        console.log("Seshat isn't installed, event indexing is disabled.");
    } else {
        console.warn("Seshat unexpected error:", e);
    }
}

if (argv["help"]) {
    console.log("Options:");
    console.log("  --profile-dir {path}: Path to where to store the profile.");
    console.log("  --profile {name}:     Name of alternate profile to use, allows for running multiple accounts.");
    console.log("  --devtools:           Install and use react-devtools and react-perf.");
    console.log("  --no-update:          Disable automatic updating.");
    console.log("  --hidden:             Start the application hidden in the system tray.");
    console.log("  --help:               Displays this help message.");
    console.log("And more such as --proxy, see:" +
        "https://github.com/electron/electron/blob/master/docs/api/chrome-command-line-switches.md");
    app.exit();
}

if (argv['profile-dir']) {
    app.setPath('userData', argv['profile-dir']);
} else if (argv['profile']) {
    app.setPath('userData', `${app.getPath('userData')}-${argv['profile']}`);
}

let vectorConfig = {};
try {
    vectorConfig = require('../../webapp/config.json');
} catch (e) {
    // it would be nice to check the error code here and bail if the config
    // is unparseable, but we get MODULE_NOT_FOUND in the case of a missing
    // file or invalid json, so node is just very unhelpful.
    // Continue with the defaults (ie. an empty config)
}

try {
    // Load local config and use it to override values from the one baked with the build
    const localConfig = require(path.join(app.getPath('userData'), 'config.json'));

    // If the local config has a homeserver defined, don't use the homeserver from the build
    // config. This is to avoid a problem where Riot thinks there are multiple homeservers
    // defined, and panics as a result.
    const homeserverProps = ['default_is_url', 'default_hs_url', 'default_server_name', 'default_server_config'];
    if (Object.keys(localConfig).find(k => homeserverProps.includes(k))) {
        // Rip out all the homeserver options from the vector config
        vectorConfig = Object.keys(vectorConfig)
            .filter(k => !homeserverProps.includes(k))
            .reduce((obj, key) => {obj[key] = vectorConfig[key]; return obj;}, {});
    }

    vectorConfig = Object.assign(vectorConfig, localConfig);
} catch (e) {
    // Could not load local config, this is expected in most cases.
}

const eventStorePath = path.join(app.getPath('userData'), 'EventStore');
const store = new Store({ name: "electron-config" });

let eventIndex = null;

let mainWindow = null;
global.appQuitting = false;

// It's important to call `path.join` so we don't end up with the packaged asar in the final path.
const iconFile = `riot.${process.platform === 'win32' ? 'ico' : 'png'}`;
const iconPath = path.join(__dirname, "..", "..", "img", iconFile);
const trayConfig = {
    icon_path: iconPath,
    brand: vectorConfig.brand || 'Riot',
};

// handle uncaught errors otherwise it displays
// stack traces in popup dialogs, which is terrible (which
// it will do any time the auto update poke fails, and there's
// no other way to catch this error).
// Assuming we generally run from the console when developing,
// this is far preferable.
process.on('uncaughtException', function(error) {
    console.log('Unhandled exception', error);
});

let focusHandlerAttached = false;
ipcMain.on('setBadgeCount', function(ev, count) {
    app.setBadgeCount(count);
    if (count === 0 && mainWindow) {
        mainWindow.flashFrame(false);
    }
});

ipcMain.on('loudNotification', function() {
    if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused() && !focusHandlerAttached) {
        mainWindow.flashFrame(true);
        mainWindow.once('focus', () => {
            mainWindow.flashFrame(false);
            focusHandlerAttached = false;
        });
        focusHandlerAttached = true;
    }
});

let powerSaveBlockerId = null;
ipcMain.on('app_onAction', function(ev, payload) {
    switch (payload.action) {
        case 'call_state':
            if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
                if (payload.state === 'ended') {
                    powerSaveBlocker.stop(powerSaveBlockerId);
                    powerSaveBlockerId = null;
                }
            } else {
                if (powerSaveBlockerId === null && payload.state === 'connected') {
                    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
                }
            }
            break;
    }
});

autoUpdater.on('update-downloaded', (ev, releaseNotes, releaseName, releaseDate, updateURL) => {
    if (!mainWindow) return;
    // forward to renderer
    mainWindow.webContents.send('update-downloaded', {
        releaseNotes,
        releaseName,
        releaseDate,
        updateURL,
    });
});

ipcMain.on('ipcCall', async function(ev, payload) {
    if (!mainWindow) return;

    const args = payload.args || [];
    let ret;

    switch (payload.name) {
        case 'getUpdateFeedUrl':
            ret = autoUpdater.getFeedURL();
            break;
        case 'getAutoLaunchEnabled':
            ret = await launcher.isEnabled();
            break;
        case 'setAutoLaunchEnabled':
            if (args[0]) {
                launcher.enable();
            } else {
                launcher.disable();
            }
            break;
        case 'getMinimizeToTrayEnabled':
            ret = tray.hasTray();
            break;
        case 'setMinimizeToTrayEnabled':
            if (args[0]) {
                // Create trayIcon icon
                tray.create(trayConfig);
            } else {
                tray.destroy();
            }
            store.set('minimizeToTray', args[0]);
            break;
        case 'getAutoHideMenuBarEnabled':
            ret = global.mainWindow.isMenuBarAutoHide();
            break;
        case 'setAutoHideMenuBarEnabled':
            store.set('autoHideMenuBar', args[0]);
            global.mainWindow.setAutoHideMenuBar(args[0]);
            global.mainWindow.setMenuBarVisibility(!args[0]);
            break;
        case 'getAppVersion':
            ret = app.getVersion();
            break;
        case 'focusWindow':
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            } else if (!mainWindow.isVisible()) {
                mainWindow.show();
            } else {
                mainWindow.focus();
            }
            break;
        case 'getConfig':
            ret = vectorConfig;
            break;

        default:
            mainWindow.webContents.send('ipcReply', {
                id: payload.id,
                error: "Unknown IPC Call: " + payload.name,
            });
            return;
    }

    mainWindow.webContents.send('ipcReply', {
        id: payload.id,
        reply: ret,
    });
});

ipcMain.on('seshat', async function(ev, payload) {
    if (!mainWindow) return;

    const sendError = (id, e) => {
        const error = {
            message: e.message
        }

        mainWindow.webContents.send('seshatReply', {
            id:id,
            error: error
        });
    }

    const args = payload.args || [];
    let ret;

    switch (payload.name) {
        case 'supportsEventIndexing':
            if (Seshat === null) ret = false;
            else ret = true;
            break;

        case 'initEventIndex':
            if (eventIndex === null) {
                try {
                    await afs.mkdir(eventStorePath, {recursive: true});
                    eventIndex = new Seshat(eventStorePath, {passphrase: "DEFAULT_PASSPHRASE"});
                } catch (e) {
                    sendError(payload.id, e);
                    return;
                }
            }
            break;

        case 'closeEventIndex':
            eventIndex = null;
            break;

        case 'deleteEventIndex':
            const deleteFolderRecursive = async(p) =>  {
                for (let entry of await afs.readdir(p)) {
                    const curPath = path.join(p, entry);
                    await afs.unlink(curPath);
                }
            }

            try {
                await deleteFolderRecursive(eventStorePath);
            } catch (e) {
            }

            break;

        case 'isEventIndexEmpty':
            if (eventIndex === null) ret = true;
            else ret = await eventIndex.isEmpty();
            break;

        case 'addEventToIndex':
            try {
                eventIndex.addEvent(args[0], args[1]);
            } catch (e) {
                sendError(payload.id, e);
                return;
            }
            break;

        case 'commitLiveEvents':
            try {
                ret = await eventIndex.commit();
            } catch (e) {
                sendError(payload.id, e);
                return;
            }
            break;

        case 'searchEventIndex':
            try {
                ret = await eventIndex.search(args[0]);
            } catch (e) {
                sendError(payload.id, e);
                return;
            }
            break;

        case 'addHistoricEvents':
            if (eventIndex === null) ret = false;
            else {
                try {
                    ret = await eventIndex.addHistoricEvents(
                        args[0], args[1], args[2]);
                } catch (e) {
                    sendError(payload.id, e);
                    return;
                }
            }
            break;

        case 'removeCrawlerCheckpoint':
            if (eventIndex === null) ret = false;
            else {
                try {
                    ret = await eventIndex.removeCrawlerCheckpoint(args[0]);
                } catch (e) {
                    sendError(payload.id, e);
                    return;
                }
            }
            break;

        case 'addCrawlerCheckpoint':
            if (eventIndex === null) ret = false;
            else {
                try {
                    ret = await eventIndex.addCrawlerCheckpoint(args[0]);
                } catch (e) {
                    sendError(payload.id, e);
                    return;
                }
            }
            break;

        case 'loadCheckpoints':
            if (eventIndex === null) ret = [];
            else {
                try {
                    ret = await eventIndex.loadCheckpoints();
                } catch (e) {
                    ret = [];
                }
            }
            break;

        default:
            mainWindow.webContents.send('seshatReply', {
                id: payload.id,
                error: "Unknown IPC Call: " + payload.name,
            });
            return;
    }

    mainWindow.webContents.send('seshatReply', {
        id: payload.id,
        reply: ret,
    });
});

app.commandLine.appendSwitch('--enable-usermedia-screen-capturing');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    console.log('Other instance detected: exiting');
    app.exit();
}

const launcher = new AutoLaunch({
    name: vectorConfig.brand || 'Riot',
    isHidden: true,
    mac: {
        useLaunchAgent: true,
    },
});

// Register the scheme the app is served from as 'standard'
// which allows things like relative URLs and IndexedDB to
// work.
// Also mark it as secure (ie. accessing resources from this
// protocol and HTTPS won't trigger mixed content warnings).
protocol.registerSchemesAsPrivileged([{
    scheme: 'vector',
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
    },
}]);

app.on('ready', () => {
    if (argv['devtools']) {
        try {
            const { default: installExt, REACT_DEVELOPER_TOOLS, REACT_PERF } = require('electron-devtools-installer');
            installExt(REACT_DEVELOPER_TOOLS)
                .then((name) => console.log(`Added Extension: ${name}`))
                .catch((err) => console.log('An error occurred: ', err));
            installExt(REACT_PERF)
                .then((name) => console.log(`Added Extension: ${name}`))
                .catch((err) => console.log('An error occurred: ', err));
        } catch (e) {
            console.log(e);
        }
    }

    protocol.registerFileProtocol('vector', (request, callback) => {
        if (request.method !== 'GET') {
            callback({error: -322}); // METHOD_NOT_SUPPORTED from chromium/src/net/base/net_error_list.h
            return null;
        }

        const parsedUrl = new URL(request.url);
        if (parsedUrl.protocol !== 'vector:') {
            callback({error: -302}); // UNKNOWN_URL_SCHEME
            return;
        }
        if (parsedUrl.host !== 'vector') {
            callback({error: -105}); // NAME_NOT_RESOLVED
            return;
        }

        const target = parsedUrl.pathname.split('/');

        // path starts with a '/'
        if (target[0] !== '') {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }

        if (target[target.length - 1] == '') {
            target[target.length - 1] = 'index.html';
        }

        let baseDir;
        // first part of the path determines where we serve from
        if (target[1] === 'webapp') {
            baseDir = __dirname + "/../../webapp";
        } else {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }

        // Normalise the base dir and the target path separately, then make sure
        // the target path isn't trying to back out beyond its root
        baseDir = path.normalize(baseDir);

        const relTarget = path.normalize(path.join(...target.slice(2)));
        if (relTarget.startsWith('..')) {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }
        const absTarget = path.join(baseDir, relTarget);

        callback({
            path: absTarget,
        });
    }, (error) => {
        if (error) console.error('Failed to register protocol');
    });

    if (argv['no-update']) {
        console.log('Auto update disabled via command line flag "--no-update"');
    } else if (vectorConfig['update_base_url']) {
        console.log(`Starting auto update with base URL: ${vectorConfig['update_base_url']}`);
        updater.start(vectorConfig['update_base_url']);
    } else {
        console.log('No update_base_url is defined: auto update is disabled');
    }

    // Load the previous window state with fallback to defaults
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1024,
        defaultHeight: 768,
    });

    const preloadScript = path.normalize(`${__dirname}/preload.js`);
    mainWindow = global.mainWindow = new BrowserWindow({
        icon: iconPath,
        show: false,
        autoHideMenuBar: store.get('autoHideMenuBar', true),

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: preloadScript,
            nodeIntegration: false,
            sandbox: true,
            enableRemoteModule: false,
            // We don't use this: it's useful for the preload script to
            // share a context with the main page so we can give select
            // objects to the main page. The sandbox option isolates the
            // main page from the background script.
            contextIsolation: false,
            webgl: false,
        },
    });
    mainWindow.loadURL('vector://vector/webapp/');
    Menu.setApplicationMenu(vectorMenu);

    // Create trayIcon icon
    if (store.get('minimizeToTray', true)) tray.create(trayConfig);

    mainWindow.once('ready-to-show', () => {
        mainWindowState.manage(mainWindow);

        if (!argv['hidden']) {
            mainWindow.show();
        } else {
            // hide here explicitly because window manage above sometimes shows it
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = global.mainWindow = null;
    });
    mainWindow.on('close', (e) => {
        // If we are not quitting and have a tray icon then minimize to tray
        if (!global.appQuitting && (tray.hasTray() || process.platform === 'darwin')) {
            // On Mac, closing the window just hides it
            // (this is generally how single-window Mac apps
            // behave, eg. Mail.app)
            e.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    if (process.platform === 'win32') {
        // Handle forward/backward mouse buttons in Windows
        mainWindow.on('app-command', (e, cmd) => {
            if (cmd === 'browser-backward' && mainWindow.webContents.canGoBack()) {
                mainWindow.webContents.goBack();
            } else if (cmd === 'browser-forward' && mainWindow.webContents.canGoForward()) {
                mainWindow.webContents.goForward();
            }
        });
    }

    webContentsHandler(mainWindow.webContents);
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    mainWindow.show();
});

app.on('before-quit', () => {
    global.appQuitting = true;
    if (mainWindow) {
        mainWindow.webContents.send('before-quit');
    }
});

app.on('second-instance', (ev, commandLine, workingDirectory) => {
    // If other instance launched with --hidden then skip showing window
    if (commandLine.includes('--hidden')) return;

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Set the App User Model ID to match what the squirrel
// installer uses for the shortcut icon.
// This makes notifications work on windows 8.1 (and is
// a noop on other platforms).
app.setAppUserModelId('com.squirrel.riot-web.Riot');
