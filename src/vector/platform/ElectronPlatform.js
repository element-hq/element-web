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

import VectorBasePlatform, {updateStateEnum} from './VectorBasePlatform';
import dis from 'matrix-react-sdk/lib/dispatcher';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import q from 'q';
import electron, {remote, ipcRenderer} from 'electron';

remote.autoUpdater.on('update-downloaded', onUpdateDownloaded);

function onUpdateDownloaded(ev: Event, releaseNotes: string, ver: string, date: Date, updateURL: string) {
    dis.dispatch({
        action: 'new_version',
        currentVersion: remote.app.getVersion(),
        newVersion: ver,
        releaseNotes: releaseNotes,
    });
}

function platformFriendlyName(): string {
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

function _onAction(payload: Object) {
    // Whitelist payload actions, no point sending most across
    if (['call_state'].includes(payload.action)) {
        ipcRenderer.send('app_onAction', payload);
    }
}

export default class ElectronPlatform extends VectorBasePlatform {
    constructor() {
        super();
        dis.register(_onAction);
        this.updatable = Boolean(remote.autoUpdater.getFeedURL());
    }

    getHumanReadableName(): string {
        return 'Electron Platform'; // no translation required: only used for analytics
    }

    setNotificationCount(count: number) {
        if (this.notificationCount === count) return;
        super.setNotificationCount(count);

        ipcRenderer.send('setBadgeCount', count);
    }

    supportsNotifications(): boolean {
        return true;
    }

    maySendNotifications(): boolean {
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
            },
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

    loudNotification(ev: Event, room: Object) {
        ipcRenderer.send('loudNotification');
    }

    clearNotification(notif: Notification) {
        notif.close();
    }

    getAppVersion(): Promise<string> {
        return q(remote.app.getVersion());
    }

    checkForUpdate() { // manual update check for this platform
        const deferred = q.defer();

        const _onUpdateAvailable = function() {
            electron.autoUpdater.removeListener('update-not-available', _onUpdateNotAvailable);
            deferred.resolve(updateStateEnum.DOWNLOADING);
        }

        const _onUpdateNotAvailable = function() {
            electron.autoUpdater.removeListener('update-available', _onUpdateAvailable);
            deferred.resolve(updateStateEnum.NOTAVAILABLE);
        }

        electron.autoUpdater.once('update-available', _onUpdateAvailable);
        electron.autoUpdater.once('update-not-available', _onUpdateNotAvailable);

        electron.ipcRenderer.send('checkForUpdates');
        return deferred.promise.timeout(10000).catch(() => {
            electron.autoUpdater.removeListener('update-not-available', _onUpdateNotAvailable);
            electron.autoUpdater.removeListener('update-available', _onUpdateAvailable);
            return updateStateEnum.TIMEOUT;
        });
    }

    installUpdate() {
        // IPC to the main process to install the update, since quitAndInstall
        // doesn't fire the before-quit event so the main process needs to know
        // it should exit.
        electron.ipcRenderer.send('install_update');
    }

    getDefaultDeviceDisplayName(): string {
        return _t('Riot Desktop on %(platformName)s', { platformName: platformFriendlyName() });
    }

    screenCaptureErrorString(): ?string {
        return null;
    }

    isElectron(): boolean { return true; }

    requestNotificationPermission(): Promise<string> {
        return q('granted');
    }

    reload() {
        remote.getCurrentWebContents().reload();
    }
}
