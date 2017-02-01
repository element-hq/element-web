/*
Copyright 2017 Karl Glatz <karl@glatz.biz>
Copyright 2017 OpenMarket Ltd

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
        if (win.isVisible() && !win.isMinimized()) {
            win.hide();
        } else {
            if (win.isMinimized()) win.restore();
            if (!win.isVisible()) win.show();
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
