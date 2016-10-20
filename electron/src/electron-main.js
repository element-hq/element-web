// @flow
const electron = require('electron');
const url = require('url');

const PERMITTED_URL_SCHEMES = [
    'http:',
    'https:',
    'mailto:',
];

let mainWindow = null;
let appQuitting = false;

function onWindowOrNavigate(ev, target) {
    // always prevent the default: if something goes wrong,
    // we don't want to end up opening it in the electron
    // app, as we could end up opening any sort of random
    // url in a window that has node scripting access.
    ev.preventDefault();

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
        open(new_target);
        electron.shell.openExternal(new_target);
    }
}

electron.app.on('ready', () => {
    mainWindow = new electron.BrowserWindow({
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

    mainWindow.webContents.on('new-window', onWindowOrNavigate);
    mainWindow.webContents.on('will-navigate', onWindowOrNavigate);
});

electron.app.on('window-all-closed', () => {
    app.quit();
});

electron.app.on('activate', () => {
    mainWindow.show();
});

electron.app.on('before-quit', () => {
    appQuitting = true;
});
