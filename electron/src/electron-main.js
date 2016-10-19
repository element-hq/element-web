// @flow
const {app, BrowserWindow} = require('electron');

let mainWindow = null;
let appQuitting = false;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        icon: `${__dirname}/../../vector/img/logo.png`,
        width: 1024, height: 768,
    });
    mainWindow.loadURL(`file://${__dirname}/../../vector/index.html`);
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
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    mainWindow.show();
});

app.on('before-quit', () => {
    appQuitting = true;
});
