/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixEvent,
    MatrixEventEvent,
    type Room,
    RoomEvent,
    ClientEvent,
    MsgType,
    SyncState,
    type SyncStateData,
    type IRoomTimelineData,
    M_LOCATION,
    EventType,
    TypedEventEmitter,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type PermissionChanged as PermissionChangedEvent } from "@matrix-org/analytics-events/types/typescript/PermissionChanged";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

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
import { stripPlainReply } from "./utils/Reply";
import { BackgroundAudio } from "./audio/BackgroundAudio";

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
        const name = event.sender?.name;
        return _t("notifier|m.key.verification.request", { name });
    },
    [M_LOCATION.name]: (event: MatrixEvent) => {
        return TextForEvent.textForLocationEvent(event)();
    },
    [M_LOCATION.altName]: (event: MatrixEvent) => {
        return TextForEvent.textForLocationEvent(event)();
    },
    [MsgType.Audio]: (event: MatrixEvent): string | null => {
        return TextForEvent.textForEvent(event, MatrixClientPeg.safeGet());
    },
};

export const enum NotifierEvent {
    NotificationHiddenChange = "notification_hidden_change",
}

interface EmittedEvents {
    [NotifierEvent.NotificationHiddenChange]: (hidden: boolean) => void;
}

class NotifierClass extends TypedEventEmitter<keyof EmittedEvents, EmittedEvents> {
    private notifsByRoom: Record<string, Notification[]> = {};

    // A list of event IDs that we've received but need to wait until
    // they're decrypted until we decide whether to notify for them
    // or not
    private pendingEncryptedEventIds: string[] = [];

    private toolbarHidden?: boolean;
    private isSyncing?: boolean;

    private backgroundAudio = new BackgroundAudio();

    public notificationMessageForEvent(ev: MatrixEvent): string | null {
        const msgType = ev.getContent().msgtype;
        if (msgType && msgTypeHandlers.hasOwnProperty(msgType)) {
            return msgTypeHandlers[msgType](ev);
        }
        return TextForEvent.textForEvent(ev, MatrixClientPeg.safeGet());
    }

    // XXX: exported for tests
    public displayPopupNotification(ev: MatrixEvent, room: Room): void {
        const plaf = PlatformPeg.get();
        const cli = MatrixClientPeg.safeGet();
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
                msg = stripPlainReply(ev.getContent().body);
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
                msg = stripPlainReply(ev.getContent().body);
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
        size: number;
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
        const cli = MatrixClientPeg.safeGet();
        if (localNotificationsAreSilenced(cli)) {
            return;
        }

        // Play notification sound here
        const sound = this.getSoundForRoom(room.roomId);
        logger.log(`Got sound ${sound?.name || "default"} for ${room.roomId}`);

        if (sound) {
            await this.backgroundAudio.play(sound.url);
        } else {
            await this.backgroundAudio.pickFormatAndPlay("media/message", ["mp3", "ogg"]);
        }
    }

    public start(): void {
        const cli = MatrixClientPeg.safeGet();
        cli.on(RoomEvent.Timeline, this.onEvent);
        cli.on(RoomEvent.Receipt, this.onRoomReceipt);
        cli.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        cli.on(ClientEvent.Sync, this.onSyncStateChange);
        this.toolbarHidden = false;
        this.isSyncing = false;
    }

    public stop(): void {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get()!.removeListener(RoomEvent.Timeline, this.onEvent);
            MatrixClientPeg.get()!.removeListener(RoomEvent.Receipt, this.onRoomReceipt);
            MatrixClientPeg.get()!.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
            MatrixClientPeg.get()!.removeListener(ClientEvent.Sync, this.onSyncStateChange);
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
                            ? _t("settings|notifications|error_permissions_denied", { brand })
                            : _t("settings|notifications|error_permissions_missing", {
                                  brand,
                              });
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|notifications|error_title"),
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
        this.emit(NotifierEvent.NotificationHiddenChange, hidden);
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
    public onSyncStateChange = (state: SyncState, prevState: SyncState | null, data?: SyncStateData): void => {
        if (state === SyncState.Syncing) {
            this.isSyncing = true;
        } else if (state === SyncState.Stopped || state === SyncState.Error) {
            this.isSyncing = false;
        }

        // wait for first non-cached sync to complete
        if (![SyncState.Stopped, SyncState.Error].includes(state) && !data?.fromCache) {
            createLocalNotificationSettingsIfNeeded(MatrixClientPeg.safeGet());
        }
    };

    private onEvent = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (removed) return; // only notify for new events, not removed ones
        if (!data.liveEvent || !!toStartOfTimeline) return; // only notify for new things, not old.
        if (!this.isSyncing) return; // don't alert for any messages initially
        if (ev.getSender() === MatrixClientPeg.safeGet().getUserId()) return;
        if (data.timeline.getTimelineSet().threadListType !== null) return; // Ignore events on the thread list generated timelines

        MatrixClientPeg.safeGet().decryptEventIfNeeded(ev);

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
        let roomId = ev.getRoomId()!;
        if (LegacyCallHandler.instance.getSupportsVirtualRooms()) {
            // Attempt to translate a virtual room to a native one
            const nativeRoomId = VoipUserMapper.sharedInstance().nativeRoomForVirtualRoom(roomId);
            if (nativeRoomId) {
                roomId = nativeRoomId;
            }
        }
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) {
            // e.g we are in the process of joining a room.
            // Seen in the Playwright lazy-loading test.
            return;
        }

        const actions = MatrixClientPeg.safeGet().getPushActionsForEvent(ev);

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
        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(ev.getRoomId());
        const thisUserHasConnectedDevice =
            room && MatrixRTCSession.callMembershipsForRoom(room).some((m) => m.sender === cli.getUserId());

        // Check maximum age (<= 15 seconds) of a call notify event that will trigger a ringing notification
        if (EventType.CallNotify === ev.getType() && (ev.getAge() ?? 0) < 15000 && !thisUserHasConnectedDevice) {
            const content = ev.getContent();
            const roomId = ev.getRoomId();
            if (typeof content.call_id !== "string") {
                logger.warn("Received malformatted CallNotify event. Did not contain 'call_id' of type 'string'");
                return;
            }
            if (!roomId) {
                logger.warn("Could not get roomId for CallNotify event");
                return;
            }
            ToastStore.sharedInstance().addOrReplaceToast({
                key: getIncomingCallToastKey(content.call_id, roomId),
                priority: 100,
                component: IncomingCallToast,
                bodyClassName: "mx_IncomingCallToast",
                props: { notifyEvent: ev },
            });
        }
    }
}

if (!window.mxNotifier) {
    window.mxNotifier = new NotifierClass();
}

export default window.mxNotifier;
export const Notifier: NotifierClass = window.mxNotifier;
