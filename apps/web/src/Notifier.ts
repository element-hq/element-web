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
    MatrixEvent,
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
import { type SessionMembershipData, type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import * as TextForEvent from "./TextForEvent";
import * as Avatar from "./Avatar";
import { _t } from "./languageHandler";
import Modal from "./Modal";
import SettingsStore from "./settings/SettingsStore";
import { hideToast as hideNotificationsToast } from "./toasts/DesktopNotificationsToast";
import { SettingLevel } from "./settings/SettingLevel";
import { isPushNotifyDisabled } from "./settings/controllers/NotificationControllers";
import UserActivity from "./UserActivity";
import { mediaFromMxc } from "./customisations/Media";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import { type SDKContextClass } from "./contexts/SDKContextClass.ts";
import { localNotificationsAreSilenced, createLocalNotificationSettingsIfNeeded } from "./utils/notifications";
import { getIncomingCallToastKey, getNotificationEventSendTs, IncomingCallToast } from "./toasts/IncomingCallToast";
import ToastStore from "./stores/ToastStore";
import { stripPlainReply } from "./utils/Reply";
import { BackgroundAudio } from "./audio/BackgroundAudio";
import { type MatrixDispatcher } from "./dispatcher/dispatcher.ts";

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

const MAX_PENDING_ENCRYPTED = 20;

/**
 * Minimum interval (in milliseconds) between two *audible* notification plays.
 *
 * Coalesces bursts of backlogged notifications into a single sound. This is the
 * in-repo remedy for https://github.com/element-hq/element-web/issues/31996: on
 * macOS Sequoia, waking from sleep delivers the entire sync backlog in one
 * batch, so every backlogged notifying event fires {@link
 * NotifierClass.playAudioNotification} near-simultaneously and the identical
 * audio buffers superimpose into one loud "stacked" sound.
 *
 * The throttle is keyed on the resolved sound, so a backlog of identical sounds
 * coalesces to one play while two genuinely *different* sounds (e.g. a custom
 * per-room sound) arriving within the window each still play. A conservative
 * window is intentional: merging a burst of the same sound is preferable to a
 * wall of overlapping audio.
 *
 * NOTE: This only cures the sounds-enabled renderer Web-Audio path (the default
 * config). It does NOT fix the variant where macOS Sequoia ignores the OS
 * banner's `silent: true` and plays its own coalesced banner sound on wake;
 * that is purely OS/Electron behaviour with no in-repo lever.
 */
export const NOTIFICATION_SOUND_THROTTLE_MS = 1000;

/**
 * Extracts plain text from a message body, replacing any spoilered content
 * with '[Spoiler]' to prevent spoilers in desktop notifications.
 */
function getNotificationBodyWithoutSpoilers(ev: MatrixEvent): string {
    const content = ev.getContent();
    const plainBody = content.body ?? "";
    const formattedBody = content.formatted_body;

    if (typeof formattedBody !== "string" || !formattedBody.length) {
        return plainBody;
    }

    /** Recursively walks HTML tree to hide spoilers. */
    function replaceSpoilers(node: Node): Node {
        if (node.nodeType !== Node.ELEMENT_NODE || !(node instanceof Element)) {
            return node;
        }

        if (node.hasAttribute("data-mx-spoiler")) {
            const e = document.createElement("span");
            e.appendChild(document.createTextNode("[Spoiler]"));
            return e;
        }

        for (const childNode of node.childNodes) {
            node.replaceChild(replaceSpoilers(childNode), childNode);
        }

        return node;
    }

    try {
        // Dev note: ideally we would reuse more of the existing rendering stack
        // rather than re-parsing and updating the generated HTML here. However,
        // that rendering stack is currently quite consolidated and cannot
        // easily be refactored to allow the call-site to control how spoilers
        // are rendered. The problem is that we now need two different output
        // formats:
        // - The existing format where spoilers are wrapped in html <span> tags
        // - The new format where the spoilered text is replaced with [Spoiler]

        const parser = new DOMParser();
        const doc = parser.parseFromString(formattedBody, "text/html");

        // Use textContent rather than innerHTML/outerHTML since textContent is
        // XSS-safe and the input is untrusted.
        return replaceSpoilers(doc.body).textContent ?? plainBody;
    } catch {
        return plainBody;
    }
}

export const enum NotifierEvent {
    NotificationHiddenChange = "notification_hidden_change",
}

interface EmittedEvents {
    [NotifierEvent.NotificationHiddenChange]: (hidden: boolean) => void;
}

/**
 * Type representing a notification sound setting
 */
export type NotificationSound = {
    url: string;
    name?: string;
    type?: string;
    size?: number;
};

export default class Notifier extends TypedEventEmitter<keyof EmittedEvents, EmittedEvents> {
    private notifsByRoom: Record<string, Notification[]> = {};

    // A list of event IDs that we've received but need to wait until
    // they're decrypted until we decide whether to notify for them
    // or not
    private pendingEncryptedEventIds: string[] = [];

    private toolbarHidden?: boolean;
    private isSyncing?: boolean;

    private backgroundAudio = new BackgroundAudio();

    /**
     * Per-sound timestamp (ms, from {@link Date.now}) of the last *audible* notification, keyed by the
     * resolved sound (custom sound url, or `"default"`). Used to throttle a burst of backlogged
     * notifications of the *same* sound into a single play while letting distinct sounds through -
     * see {@link NOTIFICATION_SOUND_THROTTLE_MS}.
     */
    private readonly lastAudioNotificationMs = new Map<string, number>();

    private msgTypeHandlers: Record<string, (event: MatrixEvent) => string | null>;

    public constructor(
        private readonly dispatcher: MatrixDispatcher,
        private readonly sdkContext: SDKContextClass,
    ) {
        super();

        /*
        Override both the content body and the TextForEvent handler for specific msgtypes, in notifications.
        This is useful when the content body contains fallback text that would explain that the client can't handle a particular
        type of tile.
        */
        this.msgTypeHandlers = {
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
                return TextForEvent.textForEvent(event, this.sdkContext.client!);
            },
        };
    }

    public notificationMessageForEvent(ev: MatrixEvent): string | null {
        if (!this.sdkContext.client) return null;
        const msgType = ev.getContent().msgtype;
        if (msgType && this.msgTypeHandlers.hasOwnProperty(msgType)) {
            return this.msgTypeHandlers[msgType](ev);
        }
        return TextForEvent.textForEvent(ev, this.sdkContext.client);
    }

    // XXX: exported for tests
    public displayPopupNotification(ev: MatrixEvent, room: Room): void {
        const plaf = PlatformPeg.get();
        const cli = this.sdkContext.client;
        if (!plaf || !cli) {
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
            if (ev.getContent().body && (!msgType || !this.msgTypeHandlers.hasOwnProperty(msgType))) {
                msg = stripPlainReply(getNotificationBodyWithoutSpoilers(ev));
            }
        } else if (ev.getType() === "m.room.member") {
            // context is all in the message here, we don't need
            // to display sender info
            title = room.name;
        } else if (ev.sender) {
            title = ev.sender.name + " (" + room.name + ")";
            // notificationMessageForEvent includes sender, but we've just out sender in the title
            const msgType = ev.getContent().msgtype;
            if (ev.getContent().body && (!msgType || !this.msgTypeHandlers.hasOwnProperty(msgType))) {
                msg = stripPlainReply(getNotificationBodyWithoutSpoilers(ev));
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

    public getSoundForRoom(roomId: string): NotificationSound | null {
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
        const cli = this.sdkContext.client;
        if (!cli || localNotificationsAreSilenced(cli)) {
            return;
        }

        // Play notification sound here
        const sound = this.getSoundForRoom(room.roomId);
        logger.log(`Got sound ${sound?.name || "default"} for ${room.roomId}`);

        // Throttle audible plays so a burst of backlogged notifications - e.g. the whole sync backlog
        // delivered at once when macOS wakes from sleep - produces at most one sound per distinct sound
        // within NOTIFICATION_SOUND_THROTTLE_MS, instead of many identical buffers superimposing into one
        // loud "stacked" sound (#31996). Keyed on the resolved sound so two *different* sounds within the
        // window both still play. Runs only after the silencing gate above, so it suppresses redundant
        // *audible* plays, never the gating logic. We bail cleanly (no throw).
        const soundKey = sound?.url ?? "default";
        const now = Date.now();
        const lastPlayed = this.lastAudioNotificationMs.get(soundKey);
        if (lastPlayed !== undefined && now - lastPlayed < NOTIFICATION_SOUND_THROTTLE_MS) {
            return;
        }
        this.lastAudioNotificationMs.set(soundKey, now);

        if (sound) {
            await this.backgroundAudio.play(sound.url);
        } else {
            await this.backgroundAudio.pickFormatAndPlay("media/message", ["mp3", "ogg"]);
        }
    }

    public start(): void {
        this.sdkContext.client!.on(RoomEvent.Timeline, this.onEvent);
        this.sdkContext.client!.on(RoomEvent.Receipt, this.onRoomReceipt);
        this.sdkContext.client!.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        this.sdkContext.client!.on(ClientEvent.Sync, this.onSyncStateChange);
        this.toolbarHidden = false;
        this.isSyncing = false;
    }

    public stop(): void {
        this.sdkContext.client?.removeListener(RoomEvent.Timeline, this.onEvent);
        this.sdkContext.client?.removeListener(RoomEvent.Receipt, this.onRoomReceipt);
        this.sdkContext.client?.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        this.sdkContext.client?.removeListener(ClientEvent.Sync, this.onSyncStateChange);
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

                // oxlint-disable-next-line promise/no-callback-in-promise
                if (callback) callback();

                this.sdkContext.posthogAnalytics.trackEvent<PermissionChangedEvent>({
                    eventName: "PermissionChanged",
                    permission: "Notification",
                    granted: true,
                });
                this.dispatcher.dispatch({
                    action: "notifier_enabled",
                    value: true,
                });
            });
        } else {
            this.sdkContext.posthogAnalytics.trackEvent<PermissionChangedEvent>({
                eventName: "PermissionChanged",
                permission: "Notification",
                granted: false,
            });
            this.dispatcher.dispatch({
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
        const client = this.sdkContext.client;
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
        if (!this.sdkContext.client) return;
        if (state === SyncState.Syncing) {
            this.isSyncing = true;
        } else if (state === SyncState.Stopped || state === SyncState.Error) {
            this.isSyncing = false;
        }

        // wait for first non-cached sync to complete
        if (![SyncState.Stopped, SyncState.Error].includes(state) && !data?.fromCache) {
            createLocalNotificationSettingsIfNeeded(this.sdkContext.client);
        }
    };

    private onEvent = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (!this.sdkContext.client) return;
        if (removed) return; // only notify for new events, not removed ones
        if (!data.liveEvent || !!toStartOfTimeline) return; // only notify for new things, not old.
        if (!this.isSyncing) return; // don't alert for any messages initially
        if (ev.getSender() === this.sdkContext.client.getUserId()) return;
        if (data.timeline.getTimelineSet().threadListType !== null) return; // Ignore events on the thread list generated timelines

        this.sdkContext.client.decryptEventIfNeeded(ev);

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
            if (this.notifsByRoom[room.roomId] === undefined) return;
            for (const notif of this.notifsByRoom[room.roomId]) {
                notif.close();
            }
            delete this.notifsByRoom[room.roomId];
        }
    };

    // XXX: exported for tests
    public evaluateEvent(ev: MatrixEvent): void {
        if (!this.sdkContext.client) return;
        const roomId = ev.getRoomId()!;
        const room = this.sdkContext.client.getRoom(roomId);
        if (!room) {
            // e.g we are in the process of joining a room.
            // Seen in the Playwright lazy-loading test.
            return;
        }

        const actions = this.sdkContext.client.getPushActionsForEvent(ev);

        if (actions?.notify) {
            this.performCustomEventHandling(ev);

            const store = this.sdkContext.roomViewStore;
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
     * Handle `EventType.RTCNotification` notifications.
     * @param ev The notification event.
     * @param toaster The toast store.
     * @param room The room that contains the notification
     * @returns A promise that will always resolve.
     */
    private async handleRTCNotification(ev: MatrixEvent, toaster: ToastStore, room: Room): Promise<void> {
        // TODO: Use the call_id to get the *correct* call. We assume there is only one call per room here.
        const rtcSession = room && room.client.matrixRTC.getRoomSession(room);
        if (
            rtcSession?.slotDescription?.application == "m.call" &&
            rtcSession.memberships.some((membership) => membership.userId === room.client.getUserId())
        ) {
            // If we're already joined to the session, don't notify.
            return;
        }

        // XXX: Should use parseCallNotificationContent once the types are exported.
        const content = ev.getContent() as IRTCNotificationContent;
        const roomId = ev.getRoomId();
        const referencedMembershipEventId = ev.getRelation()?.event_id;

        // Check maximum age of a call notification event that will trigger a ringing notification
        if (Date.now() - getNotificationEventSendTs(ev) > content.lifetime) {
            logger.warn("Received outdated RTCNotification event.");
            return;
        }
        if (!roomId) {
            logger.warn("Could not get roomId for RTCNotification event");
            return;
        }
        if (!referencedMembershipEventId) {
            logger.warn("Could not get referenced membership for notification");
            return;
        }
        if (content["m.relates_to"].rel_type !== "m.reference") {
            logger.warn("Ignored RTCNotification due to invalid rel_type");
            return;
        }

        let callMembership = room?.findEventById(referencedMembershipEventId);

        if (!callMembership) {
            // Attempt to fetch from the homeserver, if we do not have the event locally.
            // This is a rare case as obviously the referenced event for a m.call notification must
            // be sent first.
            try {
                callMembership = new MatrixEvent(await room.client.fetchRoomEvent(roomId, referencedMembershipEventId));
            } catch (ex) {
                logger.warn(`Call membership for notification could not be found`, ex);
            }
        }
        // If the event could not be found even after requesting it from the homeserver.
        if (!callMembership) {
            // We will not show a call notification if there is no valid call membership.
            logger.warn(
                `Could not find call membership (${referencedMembershipEventId} ${roomId}) for notification event.`,
            );
            return;
        }

        // If we cannot determine the key, we'll accept it but assume it's empty string.
        // This means if you have malformed notifications or call memberships your notifications
        // will overwrite, but the solution to that is to use well-formed events.
        const callId = callMembership.getContent<SessionMembershipData>().call_id ?? "";
        const key = getIncomingCallToastKey(callId, roomId);

        if (toaster.hasToast(key)) {
            logger.debug(`Detected duplicate notification for call ${key}, ignoring`);
            return;
        }

        toaster.addOrReplaceToast({
            key,
            priority: 100,
            component: IncomingCallToast,
            bodyClassName: "mx_IncomingCallToast",
            props: { notificationEvent: ev },
        });
    }

    /**
     * Some events require special handling such as showing in-app toasts.
     * This function may either create a toast or ignore the event based
     * on current app state.
     */
    private performCustomEventHandling(ev: MatrixEvent): void {
        const toaster = ToastStore.sharedInstance();
        const room = this.sdkContext.client?.getRoom(ev.getRoomId());

        if (room && EventType.RTCNotification === ev.getType()) {
            // We don't need to await this.
            void this.handleRTCNotification(ev, toaster, room);
        }
    }
}
