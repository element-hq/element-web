const path = require('path');
const electron = require('electron');

const app = electron.app;
const Tray = electron.Tray;
const MenuItem = electron.MenuItem;

let trayIcon = null;

exports.hasTray = function hasTray() {
    return (trayIcon !== null);
}

exports.create = function (win, config) {
    // no trays on darwin
    if (process.platform === 'darwin' || trayIcon) {
        return;
    }

    const toggleWin = function () {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    };

    const contextMenu = electron.Menu.buildFromTemplate([
        {
            label: 'Show/Hide ' + config.brand,
            click: toggleWin
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: function () {
                app.quit();
            }
        }
    ]);

    trayIcon = new Tray(config.icon_path);
    trayIcon.setToolTip(config.brand);
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', toggleWin);
};
