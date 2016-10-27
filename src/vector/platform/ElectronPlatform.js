// @flow

/*
Copyright 2016 Aviral Dasgupta and OpenMarket Ltd

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

import BasePlatform from './BasePlatform';
import dis from 'matrix-react-sdk/lib/dispatcher';

function onUpdateDownloaded(ev, releaseNotes, ver, date, updateURL) {
    dis.dispatch({
        action: 'new_version',
        currentVersion: electron.remote.app.getVersion(),
        newVersion: ver,
        releaseNotes: releaseNotes,
    });
}

// index.js imports us unconditionally, so we need this check here as well
let electron = null, remote = null;
if (window && window.process && window.process && window.process.type === 'renderer') {
    electron = require('electron');
    electron.remote.autoUpdater.on('update-downloaded', onUpdateDownloaded);
    remote = electron.remote;
}

export default class ElectronPlatform extends BasePlatform {
    // this sometimes throws because electron is made of fail:
    // https://github.com/electron/electron/issues/7351
    // For now, let's catch the error, but I suspect it may
    // continue to fail and we might just have to accept that
    // electron's remote RPC is a non-starter for now and use IPC
    try {
        setNotificationCount(count: number) {
            super.setNotificationCount(count);
            remote.app.setBadgeCount(count);
        }
    } catch (e) {
        console.error("Failed to set notification count", e);
    }

    displayNotification(title: string, msg: string, avatarUrl: string): Notification {
        // Notifications in Electron use the HTML5 notification API
        const notification = new global.Notification(
            title,
            {
                body: msg,
                icon: avatarUrl,
                tag: "vector",
                silent: true, // we play our own sounds
            }
        );

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId
            });
            global.focus();
        };

        return notification;
    }

    clearNotification(notif: Notification) {
        notif.close();
    }

    pollForUpdate() {
        // In electron we control the update process ourselves, since
        // it needs to run in the main process, so we just run the timer
        // loop in the main electron process instead.
    }

    installUpdate() {
        // IPC to the main process to install the update, since quitAndInstall
        // doesn't fire the before-quit event so the main process needs to know
        // it should exit.
        electron.ipcRenderer.send('install_update');
    }
}
