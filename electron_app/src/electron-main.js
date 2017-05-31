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

const argv = require('minimist')(process.argv);
const electron = require('electron');
const AutoLaunch = require('auto-launch');

const tray = require('./tray');
const vectorMenu = require('./vectormenu');
const webContentsHandler = require('./webcontents-handler');

const windowStateKeeper = require('electron-window-state');

if (argv.profile) {
    electron.app.setPath('userData', `${electron.app.getPath('userData')}-${argv.profile}`);
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

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 30 * 1000;

let mainWindow = null;
let appQuitting = false;

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
            electron.autoUpdater.setFeedURL(`${updateBaseUrl}win32/${process.arch}/`);
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

let powerSaveBlockerId;
electron.ipcMain.on('app_onAction', function(ev, payload) {
    switch (payload.action) {
        case 'call_state':
            if (powerSaveBlockerId && powerSaveBlockerId.isStarted(powerSaveBlockerId)) {
                if (payload.state === 'ended') {
                    electron.powerSaveBlocker.stop(powerSaveBlockerId);
                }
            } else {
                if (payload.state === 'connected') {
                    powerSaveBlockerId = electron.powerSaveBlocker.start('prevent-display-sleep');
                }
            }
            break;
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
    electron.app.exit();
}


const launcher = new AutoLaunch({
    name: vectorConfig.brand || 'Riot',
    isHidden: true,
    mac: {
        useLaunchAgent: true,
    },
});

const settings = {
    'auto-launch': {
        get: launcher.isEnabled,
        set: function(bool) {
            if (bool) {
                return launcher.enable();
            } else {
                return launcher.disable();
            }
        },
    },
};

electron.ipcMain.on('settings_get', async function(ev) {
    const data = {};

    try {
        await Promise.all(Object.keys(settings).map(async function (setting) {
            data[setting] = await settings[setting].get();
        }));

        ev.sender.send('settings', data);
    } catch(e) { console.error(e); }
});

electron.ipcMain.on('settings_set', function(ev, key, value) {
    console.log(key, value);
    if (settings[key] && settings[key].set) {
        settings[key].set(value);
    }
});

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

    // explicitly hide because setApplicationMenu on Linux otherwise shows...
    // https://github.com/electron/electron/issues/9621
    mainWindow.hide();

    // Create trayIcon icon
    tray.create(mainWindow, {
        icon_path: iconPath,
        brand: vectorConfig.brand || 'Riot',
    });

    if (!argv.hidden) {
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

    webContentsHandler(mainWindow.webContents);
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
