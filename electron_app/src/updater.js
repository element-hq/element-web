const { app, autoUpdater, ipcMain } = require('electron');

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 30 * 1000;

function installUpdate() {
    // for some reason, quitAndInstall does not fire the
    // before-quit event, so we need to set the flag here.
    global.appQuitting = true;
    autoUpdater.quitAndInstall();
}

function pollForUpdates() {
    try {
        autoUpdater.checkForUpdates();
    } catch (e) {
        console.log('Couldn\'t check for update', e);
    }
}

module.exports = {};
module.exports.start = function startAutoUpdate(updateBaseUrl) {
    if (updateBaseUrl.slice(-1) !== '/') {
        updateBaseUrl = updateBaseUrl + '/';
    }
    try {
        let url;
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
            url = `${updateBaseUrl}macos/?localVersion=${encodeURIComponent(app.getVersion())}`;

        } else if (process.platform === 'win32') {
            url = `${updateBaseUrl}win32/${process.arch}/`;
        } else {
            // Squirrel / electron only supports auto-update on these two platforms.
            // I'm not even going to try to guess which feed style they'd use if they
            // implemented it on Linux, or if it would be different again.
            console.log('Auto update not supported on this platform');
        }

        if (url) {
            autoUpdater.setFeedURL(url);
            // We check for updates ourselves rather than using 'updater' because we need to
            // do it in the main process (and we don't really need to check every 10 minutes:
            // every hour should be just fine for a desktop app)
            // However, we still let the main window listen for the update events.
            // We also wait a short time before checking for updates the first time because
            // of squirrel on windows and it taking a small amount of time to release a
            // lock file.
            setTimeout(pollForUpdates, INITIAL_UPDATE_DELAY_MS);
            setInterval(pollForUpdates, UPDATE_POLL_INTERVAL_MS);
        }
    } catch (err) {
        // will fail if running in debug mode
        console.log('Couldn\'t enable update checking', err);
    }
}

ipcMain.on('install_update', installUpdate);
ipcMain.on('checkForUpdates', pollForUpdates);
