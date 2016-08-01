var electron = require("electron");
var path = require("path");
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;

var MainWindow = null;

app.on('window-all-closed', () => {
    if (process.platform != 'darwin') {
        app.quit();
    }
});

app.on('ready', () => {
    MainWindow = new BrowserWindow({ width: 800, height: 600 });
    MainWindow.setMenu(null);

    MainWindow.loadURL("file://" + __dirname + "/index.html");

    MainWindow.on('closed', function () {
        MainWindow = null;
    });
});
