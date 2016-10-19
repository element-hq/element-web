// @flow
const {app, BrowserWindow} = require('electron');

let mainWindow = null;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        icon: `${__dirname}/../../vector/img/logo.png`,
        width: 1024, height: 768,
    });
    mainWindow.loadURL(`file://${__dirname}/../../vector/index.html`);
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
