// @flow

/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import VectorBasePlatform, {updateCheckStatusEnum} from './VectorBasePlatform';
import BaseEventIndexManager from 'matrix-react-sdk/src/indexing/BaseEventIndexManager';
import dis from 'matrix-react-sdk/src/dispatcher';
import { _t, _td } from 'matrix-react-sdk/src/languageHandler';
import * as rageshake from 'matrix-react-sdk/src/rageshake/rageshake';
import {MatrixClient} from "matrix-js-sdk";
import Modal from "matrix-react-sdk/src/Modal";
import InfoDialog from "matrix-react-sdk/src/components/views/dialogs/InfoDialog";
import Spinner from "matrix-react-sdk/src/components/views/elements/Spinner";
import {Categories, Modifiers, registerShortcut} from "matrix-react-sdk/src/accessibility/KeyboardShortcuts";
import {Key} from "matrix-react-sdk/src/Keyboard";
import React from "react";
import {randomString} from "matrix-js-sdk/src/randomstring";

const ipcRenderer = window.ipcRenderer;
const isMac = navigator.platform.toUpperCase().includes('MAC');

function platformFriendlyName(): string {
    // used to use window.process but the same info is available here
    if (navigator.userAgent.includes('Macintosh')) {
        return 'macOS';
    } else if (navigator.userAgent.includes('FreeBSD')) {
        return 'FreeBSD';
    } else if (navigator.userAgent.includes('OpenBSD')) {
        return 'OpenBSD';
    } else if (navigator.userAgent.includes('SunOS')) {
        return 'SunOS';
    } else if (navigator.userAgent.includes('Windows')) {
        return 'Windows';
    } else if (navigator.userAgent.includes('Linux')) {
        return 'Linux';
    } else {
        return 'Unknown';
    }
}

function _onAction(payload: Object) {
    // Whitelist payload actions, no point sending most across
    if (['call_state'].includes(payload.action)) {
        ipcRenderer.send('app_onAction', payload);
    }
}

function getUpdateCheckStatus(status) {
    if (status === true) {
        return { status: updateCheckStatusEnum.DOWNLOADING };
    } else if (status === false) {
        return { status: updateCheckStatusEnum.NOTAVAILABLE };
    } else {
        return {
            status: updateCheckStatusEnum.ERROR,
            detail: status,
        };
    }
}

class SeshatIndexManager extends BaseEventIndexManager {
    constructor() {
        super();

        this._pendingIpcCalls = {};
        this._nextIpcCallId = 0;
        ipcRenderer.on('seshatReply', this._onIpcReply.bind(this));
    }

    async _ipcCall(name: string, ...args: []): Promise<{}> {
        // TODO this should be moved into the preload.js file.
        const ipcCallId = ++this._nextIpcCallId;
        return new Promise((resolve, reject) => {
            this._pendingIpcCalls[ipcCallId] = {resolve, reject};
            window.ipcRenderer.send('seshat', {id: ipcCallId, name, args});
        });
    }

    _onIpcReply(ev: {}, payload: {}) {
        if (payload.id === undefined) {
            console.warn("Ignoring IPC reply with no ID");
            return;
        }

        if (this._pendingIpcCalls[payload.id] === undefined) {
            console.warn("Unknown IPC payload ID: " + payload.id);
            return;
        }

        const callbacks = this._pendingIpcCalls[payload.id];
        delete this._pendingIpcCalls[payload.id];
        if (payload.error) {
            callbacks.reject(payload.error);
        } else {
            callbacks.resolve(payload.reply);
        }
    }

    async supportsEventIndexing(): Promise<boolean> {
        return this._ipcCall('supportsEventIndexing');
    }

    async initEventIndex(): Promise<> {
        return this._ipcCall('initEventIndex');
    }

    async addEventToIndex(ev: MatrixEvent, profile: MatrixProfile): Promise<> {
        return this._ipcCall('addEventToIndex', ev, profile);
    }

    async deleteEvent(eventId: string): Promise<boolean> {
        return this._ipcCall('deleteEvent', eventId);
    }

    async isEventIndexEmpty(): Promise<boolean> {
        return this._ipcCall('isEventIndexEmpty');
    }

    async commitLiveEvents(): Promise<> {
        return this._ipcCall('commitLiveEvents');
    }

    async searchEventIndex(searchConfig: SearchConfig): Promise<SearchResult> {
        return this._ipcCall('searchEventIndex', searchConfig);
    }

    async addHistoricEvents(
        events: [HistoricEvent],
        checkpoint: CrawlerCheckpoint | null,
        oldCheckpoint: CrawlerCheckpoint | null,
    ): Promise<> {
        return this._ipcCall('addHistoricEvents', events, checkpoint, oldCheckpoint);
    }

    async addCrawlerCheckpoint(checkpoint: CrawlerCheckpoint): Promise<> {
        return this._ipcCall('addCrawlerCheckpoint', checkpoint);
    }

    async removeCrawlerCheckpoint(checkpoint: CrawlerCheckpoint): Promise<> {
        return this._ipcCall('removeCrawlerCheckpoint', checkpoint);
    }

    async loadFileEvents(args): Promise<[EventAndProfile]> {
        return this._ipcCall('loadFileEvents', args);
    }

    async loadCheckpoints(): Promise<[CrawlerCheckpoint]> {
        return this._ipcCall('loadCheckpoints');
    }

    async closeEventIndex(): Promise<> {
        return this._ipcCall('closeEventIndex');
    }

    async getStats(): Promise<> {
        return this._ipcCall('getStats');
    }

    async deleteEventIndex(): Promise<> {
        return this._ipcCall('deleteEventIndex');
    }
}

export default class ElectronPlatform extends VectorBasePlatform {
    constructor() {
        super();

        this._pendingIpcCalls = {};
        this._nextIpcCallId = 0;
        this.eventIndexManager = new SeshatIndexManager();

        dis.register(_onAction);
        /*
            IPC Call `check_updates` returns:
            true if there is an update available
            false if there is not
            or the error if one is encountered
         */
        ipcRenderer.on('check_updates', (event, status) => {
            if (!this.showUpdateCheck) return;
            dis.dispatch({
                action: 'check_updates',
                value: getUpdateCheckStatus(status),
            });
            this.showUpdateCheck = false;
        });

        // try to flush the rageshake logs to indexeddb before quit.
        ipcRenderer.on('before-quit', function() {
            console.log('riot-desktop closing');
            rageshake.flush();
        });

        ipcRenderer.on('ipcReply', this._onIpcReply.bind(this));
        ipcRenderer.on('update-downloaded', this.onUpdateDownloaded.bind(this));

        ipcRenderer.on('preferences', () => {
            dis.dispatch({ action: 'view_user_settings' });
        });

        this.startUpdateCheck = this.startUpdateCheck.bind(this);
        this.stopUpdateCheck = this.stopUpdateCheck.bind(this);

        // register OS-specific shortcuts
        if (isMac) {
            registerShortcut(Categories.NAVIGATION, {
                keybinds: [{
                    modifiers: [Modifiers.COMMAND],
                    key: Key.COMMA,
                }],
                description: _td("Open user settings"),
            });

            registerShortcut(Categories.NAVIGATION, {
                keybinds: [{
                    modifiers: [Modifiers.COMMAND],
                    key: Key.SQUARE_BRACKET_LEFT,
                }, {
                    modifiers: [Modifiers.COMMAND],
                    key: Key.SQUARE_BRACKET_RIGHT,
                }],
                description: _td("Previous/next recently visited room or community"),
            });
        } else {
            registerShortcut(Categories.NAVIGATION, {
                keybinds: [{
                    modifiers: [Modifiers.ALT],
                    key: Key.ARROW_LEFT,
                }, {
                    modifiers: [Modifiers.ALT],
                    key: Key.ARROW_RIGHT,
                }],
                description: _td("Previous/next recently visited room or community"),
            });
        }

        // this is the opaque token we pass to the HS which when we get it in our callback we can resolve to a profile
        this.ssoID = randomString(32);
        this._ipcCall("startSSOFlow", this.ssoID);
    }

    async getConfig(): Promise<{}> {
        return this._ipcCall('getConfig');
    }

    async onUpdateDownloaded(ev, updateInfo) {
        dis.dispatch({
            action: 'new_version',
            currentVersion: await this.getAppVersion(),
            newVersion: updateInfo,
            releaseNotes: updateInfo.releaseNotes,
        });
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
        if (navigator.userAgent.includes('Linux')) {
            msg = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Notifications in Electron use the HTML5 notification API
        const notifBody = {
            body: msg,
            silent: true, // we play our own sounds
        };
        if (avatarUrl) notifBody['icon'] = avatarUrl;
        const notification = new global.Notification(title, notifBody);

        notification.onclick = () => {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId,
            });
            global.focus();
            this._ipcCall('focusWindow');
        };

        return notification;
    }

    loudNotification(ev: Event, room: Object) {
        ipcRenderer.send('loudNotification');
    }

    clearNotification(notif: Notification) {
        notif.close();
    }

    async getAppVersion(): Promise<string> {
        return this._ipcCall('getAppVersion');
    }

    supportsAutoLaunch(): boolean {
        return true;
    }

    async getAutoLaunchEnabled(): boolean {
        return this._ipcCall('getAutoLaunchEnabled');
    }

    async setAutoLaunchEnabled(enabled: boolean): void {
        return this._ipcCall('setAutoLaunchEnabled', enabled);
    }

    supportsAutoHideMenuBar(): boolean {
        // This is irelevant on Mac as Menu bars don't live in the app window
        return !isMac;
    }

    async getAutoHideMenuBarEnabled(): boolean {
        return this._ipcCall('getAutoHideMenuBarEnabled');
    }

    async setAutoHideMenuBarEnabled(enabled: boolean): void {
        return this._ipcCall('setAutoHideMenuBarEnabled', enabled);
    }

    supportsMinimizeToTray(): boolean {
        // Things other than Mac support tray icons
        return !isMac;
    }

    async getMinimizeToTrayEnabled(): boolean {
        return this._ipcCall('getMinimizeToTrayEnabled');
    }

    async setMinimizeToTrayEnabled(enabled: boolean): void {
        return this._ipcCall('setMinimizeToTrayEnabled', enabled);
    }

    async canSelfUpdate(): boolean {
        const feedUrl = await this._ipcCall('getUpdateFeedUrl');
        return Boolean(feedUrl);
    }

    startUpdateCheck() {
        if (this.showUpdateCheck) return;
        super.startUpdateCheck();

        ipcRenderer.send('check_updates');
    }

    installUpdate() {
        // IPC to the main process to install the update, since quitAndInstall
        // doesn't fire the before-quit event so the main process needs to know
        // it should exit.
        ipcRenderer.send('install_update');
    }

    getDefaultDeviceDisplayName(): string {
        return _t('Riot Desktop (%(platformName)s)', { platformName: platformFriendlyName() });
    }

    screenCaptureErrorString(): ?string {
        return null;
    }

    requestNotificationPermission(): Promise<string> {
        return Promise.resolve('granted');
    }

    reload() {
        // we used to remote to the main process to get it to
        // reload the webcontents, but in practice this is unnecessary:
        // the normal way works fine.
        window.location.reload(false);
    }

    async _ipcCall(name, ...args) {
        const ipcCallId = ++this._nextIpcCallId;
        return new Promise((resolve, reject) => {
            this._pendingIpcCalls[ipcCallId] = {resolve, reject};
            window.ipcRenderer.send('ipcCall', {id: ipcCallId, name, args});
            // Maybe add a timeout to these? Probably not necessary.
        });
    }

    _onIpcReply(ev, payload) {
        if (payload.id === undefined) {
            console.warn("Ignoring IPC reply with no ID");
            return;
        }

        if (this._pendingIpcCalls[payload.id] === undefined) {
            console.warn("Unknown IPC payload ID: " + payload.id);
            return;
        }

        const callbacks = this._pendingIpcCalls[payload.id];
        delete this._pendingIpcCalls[payload.id];
        if (payload.error) {
            callbacks.reject(payload.error);
        } else {
            callbacks.resolve(payload.reply);
        }
    }

    getEventIndexingManager(): BaseEventIndexManager | null {
        return this.eventIndexManager;
    }

    setLanguage(preferredLangs: string[]) {
        this._ipcCall('setLanguage', preferredLangs).catch(error => {
            console.log("Failed to send setLanguage IPC to Electron");
            console.error(error);
        });
    }

    getSSOCallbackUrl(hsUrl: string, isUrl: string): URL {
        const url = super.getSSOCallbackUrl(hsUrl, isUrl);
        url.protocol = "riot";
        url.searchParams.set("riot-desktop-ssoid", this.ssoID);
        return url;
    }

    startSingleSignOn(mxClient: MatrixClient, loginType: "sso" | "cas") {
        super.startSingleSignOn(mxClient, loginType); // this will get intercepted by electron-main will-navigate
        Modal.createTrackedDialog('Electron', 'SSO', InfoDialog, {
            title: _t("Go to your browser to complete Sign In"),
            description: <Spinner />,
        });
    }

    _navigateForwardBack(back: boolean) {
        this._ipcCall(back ? "navigateBack" : "navigateForward");
    }

    onKeyDown(ev: KeyboardEvent): boolean {
        let handled = false;

        switch (ev.key) {
            case Key.SQUARE_BRACKET_LEFT:
            case Key.SQUARE_BRACKET_RIGHT:
                if (isMac && ev.metaKey && !ev.altKey && !ev.ctrlKey && !ev.shiftKey) {
                    this._navigateForwardBack(ev.key === Key.SQUARE_BRACKET_LEFT);
                    handled = true;
                }
                break;

            case Key.ARROW_LEFT:
            case Key.ARROW_RIGHT:
                if (!isMac && ev.altKey && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
                    this._navigateForwardBack(ev.key === Key.ARROW_LEFT);
                    handled = true;
                }
                break;
        }

        return handled;
    }
}
