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

const {app, Tray, Menu, nativeImage} = require('electron');
const pngToIco = require('png-to-ico');
const path = require('path');
const fs = require('fs');

let trayIcon = null;

exports.hasTray = function hasTray() {
    return (trayIcon !== null);
};

exports.create = function(config) {
    // no trays on darwin
    if (process.platform === 'darwin' || trayIcon) return;

    const toggleWin = function() {
        if (global.mainWindow.isVisible() && !global.mainWindow.isMinimized()) {
            global.mainWindow.hide();
        } else {
            if (global.mainWindow.isMinimized()) global.mainWindow.restore();
            if (!global.mainWindow.isVisible()) global.mainWindow.show();
            global.mainWindow.focus();
        }
    };

    const contextMenu = Menu.buildFromTemplate([
        {
            label: `Show/Hide ${config.brand}`,
            click: toggleWin,
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: function() {
                app.quit();
            },
        },
    ]);

    const defaultIcon = nativeImage.createFromPath(config.icon_path);

    trayIcon = new Tray(defaultIcon);
    trayIcon.setToolTip(config.brand);
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', toggleWin);

    let lastFavicon = null;
    global.mainWindow.webContents.on('page-favicon-updated', async function(ev, favicons) {
        if (!favicons || favicons.length <= 0 || !favicons[0].startsWith('data:')) {
            if (lastFavicon !== null) {
                global.mainWindow.setIcon(defaultIcon);
                trayIcon.setImage(defaultIcon);
                lastFavicon = null;
            }
            return;
        }

        // No need to change, shortcut
        if (favicons[0] === lastFavicon) return;
        lastFavicon = favicons[0];

        let newFavicon = nativeImage.createFromDataURL(favicons[0]);

        // Windows likes ico's too much.
        if (process.platform === 'win32') {
            try {
                const icoPath = path.join(app.getPath('temp'), 'win32_riot_icon.ico');
                fs.writeFileSync(icoPath, await pngToIco(newFavicon.toPNG()));
                newFavicon = nativeImage.createFromPath(icoPath);
            } catch (e) {
                console.error("Failed to make win32 ico", e);
            }
        }

        trayIcon.setImage(newFavicon);
        global.mainWindow.setIcon(newFavicon);
    });

    global.mainWindow.webContents.on('page-title-updated', function(ev, title) {
        trayIcon.setToolTip(title);
    });
};
