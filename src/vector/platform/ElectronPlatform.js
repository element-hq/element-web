// @flow

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

import VectorBasePlatform from './VectorBasePlatform';
import dis from 'matrix-react-sdk/lib/dispatcher';
import q from 'q';

const electron = require('electron');
const remote = electron.remote;

remote.autoUpdater.on('update-downloaded', onUpdateDownloaded);

function onUpdateDownloaded(ev, releaseNotes, ver, date, updateURL) {
    dis.dispatch({
        action: 'new_version',
        currentVersion: remote.app.getVersion(),
        newVersion: ver,
        releaseNotes: releaseNotes,
    });
}

function platformFriendlyName() {
    console.log(window.process);
    switch (window.process.platform) {
        case 'darwin':
            return 'macOS';
        case 'freebsd':
            return 'FreeBSD';
        case 'openbsd':
            return 'OpenBSD';
        case 'sunos':
            return 'SunOS';
        case 'win32':
            return 'Windows';
        default:
            // Sorry, Linux users: you get lumped into here,
            // but only because Linux's capitalisation is
            // normal. We do care about you.
            return window.process.platform[0].toUpperCase() + window.process.platform.slice(1);
    }
}

export default class ElectronPlatform extends VectorBasePlatform {
    setNotificationCount(count: number) {
        if (this.notificationCount === count) return;
        super.setNotificationCount(count);
        // this sometimes throws because electron is made of fail:
        // https://github.com/electron/electron/issues/7351
        // For now, let's catch the error, but I suspect it may
        // continue to fail and we might just have to accept that
        // electron's remote RPC is a non-starter for now and use IPC
        try {
            remote.app.setBadgeCount(count);
        } catch (e) {
            console.error('Failed to set notification count', e);
        }
    }

    supportsNotifications() : boolean {
        return true;
    }

    maySendNotifications() : boolean {
        return true;
    }

    displayNotification(title: string, msg: string, avatarUrl: string, room: Object): Notification {

        // GNOME notification spec parses HTML tags for styling...
        // Electron Docs state all supported linux notification systems follow this markup spec
        // https://github.com/electron/electron/blob/master/docs/tutorial/desktop-environment-integration.md#linux
        // maybe we should pass basic styling (italics, bold, underline) through from MD
        // we only have to strip out < and > as the spec doesn't include anything about things like &amp;
        // so we shouldn't assume that all implementations will treat those properly. Very basic tag parsing is done.
        if (window.process.platform === 'linux') {
            msg = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Notifications in Electron use the HTML5 notification API
        const notification = new global.Notification(
            title,
            {
                body: msg,
                icon: avatarUrl,
                tag: 'vector',
                silent: true, // we play our own sounds
            }
        );

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId,
            });
            global.focus();
            const win = remote.getCurrentWindow();

            if (win.isMinimized()) win.restore();
            else if (!win.isVisible()) win.show();
            else win.focus();
        };

        return notification;
    }

    clearNotification(notif: Notification) {
        notif.close();
    }

    getAppVersion() {
        return q(remote.app.getVersion());
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

    getDefaultDeviceDisplayName() {
        return 'Riot Desktop on ' + platformFriendlyName();
    }

    screenCaptureErrorString() {
        return null;
    }

    requestNotificationPermission() : Promise {
        return q('granted');
    }

    reload() {
        remote.getCurrentWebContents().reload();
    }
}
