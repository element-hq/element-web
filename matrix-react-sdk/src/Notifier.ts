/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
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

import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/models/event";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { MsgType } from "matrix-js-sdk/src/@types/event";
import { M_LOCATION } from "matrix-js-sdk/src/@types/location";
import { PermissionChanged as PermissionChangedEvent } from "@matrix-org/analytics-events/types/typescript/PermissionChanged";
import { ISyncStateData, SyncState } from "matrix-js-sdk/src/sync";
import { IRoomTimelineData } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "./MatrixClientPeg";
import { PosthogAnalytics } from "./PosthogAnalytics";
import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import * as TextForEvent from "./TextForEvent";
import * as Avatar from "./Avatar";
import dis from "./dispatcher/dispatcher";
import { _t } from "./languageHandler";
import Modal from "./Modal";
import SettingsStore from "./settings/SettingsStore";
import { hideToast as hideNotificationsToast } from "./toasts/DesktopNotificationsToast";
import { SettingLevel } from "./settings/SettingLevel";
import { isPushNotifyDisabled } from "./settings/controllers/NotificationControllers";
import UserActivity from "./UserActivity";
import { mediaFromMxc } from "./customisations/Media";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import LegacyCallHandler from "./LegacyCallHandler";
import VoipUserMapper from "./VoipUserMapper";
import { SdkContextClass } from "./contexts/SDKContext";
import { localNotificationsAreSilenced, createLocalNotificationSettingsIfNeeded } from "./utils/notifications";
import { getIncomingCallToastKey, IncomingCallToast } from "./toasts/IncomingCallToast";
import ToastStore from "./stores/ToastStore";
import { ElementCall } from "./models/Call";
import { VoiceBroadcastChunkEventType, VoiceBroadcastInfoEventType } from "./voice-broadcast";
import { getSenderName } from "./utils/event/getSenderName";

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

const MAX_PENDING_ENCRYPTED = 20;

/*
Override both the content body and the TextForEvent handler for specific msgtypes, in notifications.
This is useful when the content body contains fallback text that would explain that the client can't handle a particular
type of tile.
*/
const msgTypeHandlers: Record<string, (event: MatrixEvent) => string | null> = {
    [MsgType.KeyVerificationRequest]: (event: MatrixEvent) => {
        const name = (event.sender || {}).name;
        return _t("%(name)s is requesting verification", { name });
    },
    [M_LOCATION.name]: (event: MatrixEvent) => {
        return TextForEvent.textForLocationEvent(event)();
    },
    [M_LOCATION.altName]: (event: MatrixEvent) => {
        return TextForEvent.textForLocationEvent(event)();
    },
    [MsgType.Audio]: (event: MatrixEvent): string | null => {
        if (event.getContent()?.[VoiceBroadcastChunkEventType]) {
            if (event.getContent()?.[VoiceBroadcastChunkEventType]?.sequence === 1) {
                // Show a notification for the first broadcast chunk.
                // At this point a user received something to listen to.
                return _t("%(senderName)s started a voice broadcast", { senderName: getSenderName(event) });
            }

            // Mute other broadcast chunks
            return null;
        }

        return TextForEvent.textForEvent(event, MatrixClientPeg.get());
    },
};

class NotifierClass {
    private notifsByRoom: Record<string, Notification[]> = {};

    // A list of event IDs that we've received but need to wait until
    // they're decrypted until we decide whether to notify for them
    // or not
    private pendingEncryptedEventIds: string[] = [];

    private toolbarHidden?: boolean;
    private isSyncing?: boolean;

    public notificationMessageForEvent(ev: MatrixEvent): string | null {
        const msgType = ev.getContent().msgtype;
        if (msgType && msgTypeHandlers.hasOwnProperty(msgType)) {
            return msgTypeHandlers[msgType](ev);
        }
        return TextForEvent.textForEvent(ev, MatrixClientPeg.get());
    }

    // XXX: exported for tests
    public displayPopupNotification(ev: MatrixEvent, room: Room): void {
        const plaf = PlatformPeg.get();
        const cli = MatrixClientPeg.get();
        if (!plaf) {
            return;
        }
        if (!plaf.supportsNotifications() || !plaf.maySendNotifications()) {
            return;
        }

        if (localNotificationsAreSilenced(cli)) {
            return;
        }

        let msg = this.notificationMessageForEvent(ev);
        if (!msg) return;

        let title: string | undefined;
        if (!ev.sender || room.name === ev.sender.name) {
            title = room.name;
            // notificationMessageForEvent includes sender, but we already have the sender here
            const msgType = ev.getContent().msgtype;
            if (ev.getContent().body && (!msgType || !msgTypeHandlers.hasOwnProperty(msgType))) {
                msg = ev.getContent().body;
            }
        } else if (ev.getType() === "m.room.member") {
            // context is all in the message here, we don't need
            // to display sender info
            title = room.name;
        } else if (ev.sender) {
            title = ev.sender.name + " (" + room.name + ")";
            // notificationMessageForEvent includes sender, but we've just out sender in the title
            const msgType = ev.getContent().msgtype;
            if (ev.getContent().body && (!msgType || !msgTypeHandlers.hasOwnProperty(msgType))) {
                msg = ev.getContent().body;
            }
        }

        if (!title) return;

        if (!this.isBodyEnabled()) {
            msg = "";
        }

        let avatarUrl: string | null = null;
        if (ev.sender && !SettingsStore.getValue("lowBandwidth")) {
            avatarUrl = Avatar.avatarUrlForMember(ev.sender, 40, 40, "crop");
        }

        const notif = plaf.displayNotification(title, msg!, avatarUrl, room, ev);

        // if displayNotification returns non-null,  the platform supports
        // clearing notifications later, so keep track of this.
        if (notif) {
            if (this.notifsByRoom[ev.getRoomId()!] === undefined) this.notifsByRoom[ev.getRoomId()!] = [];
            this.notifsByRoom[ev.getRoomId()!].push(notif);
        }
    }

    public getSoundForRoom(roomId: string): {
        url: string;
        name: string;
        type: string;
        size: string;
    } | null {
        // We do no caching here because the SDK caches setting
        // and the browser will cache the sound.
        const content = SettingsStore.getValue("notificationSound", roomId);
        if (!content) {
            return null;
        }

        if (typeof content.url !== "string") {
            logger.warn(`${roomId} has custom notification sound event, but no url string`);
            return null;
        }

        if (!content.url.startsWith("mxc://")) {
            logger.warn(`${roomId} has custom notification sound event, but url is not a mxc url`);
            return null;
        }

        // Ideally in here we could use MSC1310 to detect the type of file, and reject it.

        const url = mediaFromMxc(content.url).srcHttp;
        if (!url) {
            logger.warn("Something went wrong when generating src http url for mxc");
            return null;
        }

        return {
            url,
            name: content.name,
            type: content.type,
            size: content.size,
        };
    }

    // XXX: Exported for tests
    public async playAudioNotification(ev: MatrixEvent, room: Room): Promise<void> {
        const cli = MatrixClientPeg.get();
        if (localNotificationsAreSilenced(cli)) {
            return;
        }

        const sound = this.getSoundForRoom(room.roomId);
        logger.log(`Got sound ${(sound && sound.name) || "default"} for ${room.roomId}`);

        try {
            const selector = document.querySelector<HTMLAudioElement>(
                sound ? `audio[src='${sound.url}']` : "#messageAudio",
            );
            let audioElement = selector;
            if (!audioElement) {
                if (!sound) {
                    logger.error("No audio element or sound to play for notification");
                    return;
                }
                audioElement = new Audio(sound.url);
                if (sound.type) {
                    audioElement.type = sound.type;
                }
                document.body.appendChild(audioElement);
            }
            await audioElement.play();
        } catch (ex) {
            logger.warn("Caught error when trying to fetch room notification sound:", ex);
        }
    }

    public start(): void {
        MatrixClientPeg.get().on(RoomEvent.Timeline, this.onEvent);
        MatrixClientPeg.get().on(RoomEvent.Receipt, this.onRoomReceipt);
        MatrixClientPeg.get().on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        MatrixClientPeg.get().on(ClientEvent.Sync, this.onSyncStateChange);
        this.toolbarHidden = false;
        this.isSyncing = false;
    }

    public stop(): void {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener(RoomEvent.Timeline, this.onEvent);
            MatrixClientPeg.get().removeListener(RoomEvent.Receipt, this.onRoomReceipt);
            MatrixClientPeg.get().removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
            MatrixClientPeg.get().removeListener(ClientEvent.Sync, this.onSyncStateChange);
        }
        this.isSyncing = false;
    }

    public supportsDesktopNotifications(): boolean {
        return PlatformPeg.get()?.supportsNotifications() ?? false;
    }

    public setEnabled(enable: boolean, callback?: () => void): void {
        const plaf = PlatformPeg.get();
        if (!plaf) return;

        // Dev note: We don't set the "notificationsEnabled" setting to true here because it is a
        // calculated value. It is determined based upon whether or not the master rule is enabled
        // and other flags. Setting it here would cause a circular reference.

        // make sure that we persist the current setting audio_enabled setting
        // before changing anything
        if (SettingsStore.isLevelSupported(SettingLevel.DEVICE)) {
            SettingsStore.setValue("audioNotificationsEnabled", null, SettingLevel.DEVICE, this.isEnabled());
        }

        if (enable) {
            // Attempt to get permission from user
            plaf.requestNotificationPermission().then((result) => {
                if (result !== "granted") {
                    // The permission request was dismissed or denied
                    // TODO: Support alternative branding in messaging
                    const brand = SdkConfig.get().brand;
                    const description =
                        result === "denied"
                            ? _t(
                                  "%(brand)s does not have permission to send you notifications - " +
                                      "please check your browser settings",
                                  { brand },
                              )
                            : _t("%(brand)s was not given permission to send notifications - please try again", {
                                  brand,
                              });
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Unable to enable Notifications"),
                        description,
                    });
                    return;
                }

                if (callback) callback();

                PosthogAnalytics.instance.trackEvent<PermissionChangedEvent>({
                    eventName: "PermissionChanged",
                    permission: "Notification",
                    granted: true,
                });
                dis.dispatch({
                    action: "notifier_enabled",
                    value: true,
                });
            });
        } else {
            PosthogAnalytics.instance.trackEvent<PermissionChangedEvent>({
                eventName: "PermissionChanged",
                permission: "Notification",
                granted: false,
            });
            dis.dispatch({
                action: "notifier_enabled",
                value: false,
            });
        }
        // set the notifications_hidden flag, as the user has knowingly interacted
        // with the setting we shouldn't nag them any further
        this.setPromptHidden(true);
    }

    public isEnabled(): boolean {
        return this.isPossible() && SettingsStore.getValue("notificationsEnabled");
    }

    public isPossible(): boolean {
        const plaf = PlatformPeg.get();
        if (!plaf?.supportsNotifications()) return false;
        if (!plaf.maySendNotifications()) return false;

        return true; // possible, but not necessarily enabled
    }

    public isBodyEnabled(): boolean {
        return this.isEnabled() && SettingsStore.getValue("notificationBodyEnabled");
    }

    public isAudioEnabled(): boolean {
        // We don't route Audio via the HTML Notifications API so it is possible regardless of other things
        return SettingsStore.getValue("audioNotificationsEnabled");
    }

    public setPromptHidden(hidden: boolean, persistent = true): void {
        this.toolbarHidden = hidden;

        hideNotificationsToast();

        // update the info to localStorage for persistent settings
        if (persistent && global.localStorage) {
            global.localStorage.setItem("notifications_hidden", String(hidden));
        }
    }

    public shouldShowPrompt(): boolean {
        const client = MatrixClientPeg.get();
        if (!client) {
            return false;
        }
        const isGuest = client.isGuest();
        return (
            !isGuest &&
            this.supportsDesktopNotifications() &&
            !isPushNotifyDisabled() &&
            !this.isEnabled() &&
            !this.isPromptHidden()
        );
    }

    private isPromptHidden(): boolean {
        // Check localStorage for any such meta data
        if (global.localStorage) {
            return global.localStorage.getItem("notifications_hidden") === "true";
        }

        return !!this.toolbarHidden;
    }

    // XXX: Exported for tests
    public onSyncStateChange = (state: SyncState, prevState: SyncState | null, data?: ISyncStateData): void => {
        if (state === SyncState.Syncing) {
            this.isSyncing = true;
        } else if (state === SyncState.Stopped || state === SyncState.Error) {
            this.isSyncing = false;
        }

        // wait for first non-cached sync to complete
        if (![SyncState.Stopped, SyncState.Error].includes(state) && !data?.fromCache) {
            createLocalNotificationSettingsIfNeeded(MatrixClientPeg.get());
        }
    };

    private onEvent = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (!data.liveEvent) return; // only notify for new things, not old.
        if (!this.isSyncing) return; // don't alert for any messages initially
        if (ev.getSender() === MatrixClientPeg.get().getUserId()) return;

        MatrixClientPeg.get().decryptEventIfNeeded(ev);

        // If it's an encrypted event and the type is still 'm.room.encrypted',
        // it hasn't yet been decrypted, so wait until it is.
        if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
            this.pendingEncryptedEventIds.push(ev.getId()!);
            // don't let the list fill up indefinitely
            while (this.pendingEncryptedEventIds.length > MAX_PENDING_ENCRYPTED) {
                this.pendingEncryptedEventIds.shift();
            }
            return;
        }

        this.evaluateEvent(ev);
    };

    private onEventDecrypted = (ev: MatrixEvent): void => {
        // 'decrypted' means the decryption process has finished: it may have failed,
        // in which case it might decrypt soon if the keys arrive
        if (ev.isDecryptionFailure()) return;

        const idx = this.pendingEncryptedEventIds.indexOf(ev.getId()!);
        if (idx === -1) return;

        this.pendingEncryptedEventIds.splice(idx, 1);
        this.evaluateEvent(ev);
    };

    private onRoomReceipt = (ev: MatrixEvent, room: Room): void => {
        if (room.getUnreadNotificationCount() === 0) {
            // ideally we would clear each notification when it was read,
            // but we have no way, given a read receipt, to know whether
            // the receipt comes before or after an event, so we can't
            // do this. Instead, clear all notifications for a room once
            // there are no notifs left in that room., which is not quite
            // as good but it's something.
            const plaf = PlatformPeg.get();
            if (!plaf) return;
            if (this.notifsByRoom[room.roomId] === undefined) return;
            for (const notif of this.notifsByRoom[room.roomId]) {
                plaf.clearNotification(notif);
            }
            delete this.notifsByRoom[room.roomId];
        }
    };

    // XXX: exported for tests
    public evaluateEvent(ev: MatrixEvent): void {
        // Mute notifications for broadcast info events
        if (ev.getType() === VoiceBroadcastInfoEventType) return;
        let roomId = ev.getRoomId()!;
        if (LegacyCallHandler.instance.getSupportsVirtualRooms()) {
            // Attempt to translate a virtual room to a native one
            const nativeRoomId = VoipUserMapper.sharedInstance().nativeRoomForVirtualRoom(roomId);
            if (nativeRoomId) {
                roomId = nativeRoomId;
            }
        }
        const room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) {
            // e.g we are in the process of joining a room.
            // Seen in the cypress lazy-loading test.
            return;
        }

        const actions = MatrixClientPeg.get().getPushActionsForEvent(ev);

        if (actions?.notify) {
            this.performCustomEventHandling(ev);

            const store = SdkContextClass.instance.roomViewStore;
            const isViewingRoom = store.getRoomId() === room.roomId;
            const threadId: string | undefined = ev.getId() !== ev.threadRootId ? ev.threadRootId : undefined;
            const isViewingThread = store.getThreadId() === threadId;

            const isViewingEventTimeline = isViewingRoom && (!threadId || isViewingThread);

            if (isViewingEventTimeline && UserActivity.sharedInstance().userActiveRecently() && !Modal.hasDialogs()) {
                // don't bother notifying as user was recently active in this room
                return;
            }

            if (this.isEnabled()) {
                this.displayPopupNotification(ev, room);
            }
            if (actions.tweaks.sound && this.isAudioEnabled()) {
                PlatformPeg.get()?.loudNotification(ev, room);
                this.playAudioNotification(ev, room);
            }
        }
    }

    /**
     * Some events require special handling such as showing in-app toasts
     */
    private performCustomEventHandling(ev: MatrixEvent): void {
        if (ElementCall.CALL_EVENT_TYPE.names.includes(ev.getType()) && SettingsStore.getValue("feature_group_calls")) {
            ToastStore.sharedInstance().addOrReplaceToast({
                key: getIncomingCallToastKey(ev.getStateKey()!),
                priority: 100,
                component: IncomingCallToast,
                bodyClassName: "mx_IncomingCallToast",
                props: { callEvent: ev },
            });
        }
    }
}

if (!window.mxNotifier) {
    window.mxNotifier = new NotifierClass();
}

export default window.mxNotifier;
export const Notifier: NotifierClass = window.mxNotifier;
