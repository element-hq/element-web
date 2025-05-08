/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    TypedEventEmitter,
    RoomEvent,
    RoomStateEvent,
    EventType,
    type MatrixClient,
    type IMyDevice,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership, type Membership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { NamespacedValue } from "matrix-js-sdk/src/NamespacedValue";
import { type IWidgetApiRequest, type ClientWidgetApi, type IWidgetData } from "matrix-widget-api";
import {
    MatrixRTCSession,
    MatrixRTCSessionEvent,
    type CallMembership,
    MatrixRTCSessionManagerEvents,
    type ICallNotifyContent,
} from "matrix-js-sdk/src/matrixrtc";

import type EventEmitter from "events";
import type { IApp } from "../stores/WidgetStore";
import SettingsStore from "../settings/SettingsStore";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../MediaDeviceHandler";
import { timeout } from "../utils/promise";
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetType } from "../widgets/WidgetType";
import { ElementWidgetActions } from "../stores/widgets/ElementWidgetActions";
import WidgetStore from "../stores/WidgetStore";
import { WidgetMessagingStore, WidgetMessagingStoreEvent } from "../stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../stores/ActiveWidgetStore";
import { getCurrentLanguage } from "../languageHandler";
import { Anonymity, PosthogAnalytics } from "../PosthogAnalytics";
import { UPDATE_EVENT } from "../stores/AsyncStore";
import { getJoinedNonFunctionalMembers } from "../utils/room/getJoinedNonFunctionalMembers";
import { isVideoRoom } from "../utils/video-rooms";
import { FontWatcher } from "../settings/watchers/FontWatcher";
import { type JitsiCallMemberContent, JitsiCallMemberEventType } from "../call-types";
import SdkConfig from "../SdkConfig.ts";

const TIMEOUT_MS = 16000;

// Waits until an event is emitted satisfying the given predicate
const waitForEvent = async (
    emitter: EventEmitter,
    event: string,
    pred: (...args: any[]) => boolean = () => true,
    customTimeout?: number | false,
): Promise<void> => {
    let listener: (...args: any[]) => void;
    const wait = new Promise<void>((resolve) => {
        listener = (...args) => {
            if (pred(...args)) resolve();
        };
        emitter.on(event, listener);
    });

    if (customTimeout !== false) {
        const timedOut = (await timeout(wait, false, customTimeout ?? TIMEOUT_MS)) === false;
        if (timedOut) throw new Error("Timed out");
    } else {
        await wait;
    }
    emitter.off(event, listener!);
};

export enum ConnectionState {
    Disconnected = "disconnected",
    Connected = "connected",
    Disconnecting = "disconnecting",
}

export const isConnected = (state: ConnectionState): boolean =>
    state === ConnectionState.Connected || state === ConnectionState.Disconnecting;

export enum Layout {
    Tile = "tile",
    Spotlight = "spotlight",
}

export enum CallEvent {
    ConnectionState = "connection_state",
    Participants = "participants",
    Layout = "layout",
    Close = "close",
    Destroy = "destroy",
}

interface CallEventHandlerMap {
    [CallEvent.ConnectionState]: (state: ConnectionState, prevState: ConnectionState) => void;
    [CallEvent.Participants]: (
        participants: Map<RoomMember, Set<string>>,
        prevParticipants: Map<RoomMember, Set<string>>,
    ) => void;
    [CallEvent.Layout]: (layout: Layout) => void;
    [CallEvent.Close]: () => void;
    [CallEvent.Destroy]: () => void;
}

/**
 * A group call accessed through a widget.
 */
export abstract class Call extends TypedEventEmitter<CallEvent, CallEventHandlerMap> {
    protected readonly widgetUid: string;
    protected readonly room: Room;

    /**
     * The time after which device member state should be considered expired.
     */
    public abstract readonly STUCK_DEVICE_TIMEOUT_MS: number;

    private _messaging: ClientWidgetApi | null = null;
    /**
     * The widget's messaging, or null if disconnected.
     */
    protected get messaging(): ClientWidgetApi | null {
        return this._messaging;
    }
    private set messaging(value: ClientWidgetApi | null) {
        this._messaging = value;
    }

    public get roomId(): string {
        return this.widget.roomId;
    }

    private _connectionState = ConnectionState.Disconnected;
    public get connectionState(): ConnectionState {
        return this._connectionState;
    }
    protected set connectionState(value: ConnectionState) {
        const prevValue = this._connectionState;
        this._connectionState = value;
        this.emit(CallEvent.ConnectionState, value, prevValue);
    }

    public get connected(): boolean {
        return isConnected(this.connectionState);
    }

    private _participants = new Map<RoomMember, Set<string>>();
    /**
     * The participants in the call, as a map from members to device IDs.
     */
    public get participants(): Map<RoomMember, Set<string>> {
        return this._participants;
    }
    protected set participants(value: Map<RoomMember, Set<string>>) {
        const prevValue = this._participants;
        this._participants = value;
        this.emit(CallEvent.Participants, value, prevValue);
    }

    private _presented = false;
    /**
     * Whether the call widget is currently being presented in the user interface.
     */
    public get presented(): boolean {
        return this._presented;
    }
    public set presented(value: boolean) {
        this._presented = value;
    }

    protected constructor(
        /**
         * The widget used to access this call.
         */
        public readonly widget: IApp,
        protected readonly client: MatrixClient,
    ) {
        super();
        this.widgetUid = WidgetUtils.getWidgetUid(this.widget);
        this.room = this.client.getRoom(this.roomId)!;
        WidgetMessagingStore.instance.on(WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
    }

    /**
     * Gets the call associated with the given room, if any.
     * @param {Room} room The room.
     * @returns {Call | null} The call.
     */
    public static get(room: Room): Call | null {
        return ElementCall.get(room) ?? JitsiCall.get(room);
    }

    /**
     * Performs a routine check of the call's associated room state, cleaning up
     * any data left over from an unclean disconnection.
     */
    public abstract clean(): Promise<void>;

    /**
     * Contacts the widget to connect to the call or prompt the user to connect to the call.
     * @param {MediaDeviceInfo | null} audioInput The audio input to use, or
     *   null to start muted.
     * @param {MediaDeviceInfo | null} audioInput The video input to use, or
     *   null to start muted.
     */
    protected abstract performConnection(
        audioInput: MediaDeviceInfo | null,
        videoInput: MediaDeviceInfo | null,
    ): Promise<void>;

    /**
     * Contacts the widget to disconnect from the call.
     */
    protected abstract performDisconnection(): Promise<void>;

    /**
     * Starts the communication between the widget and the call.
     * The call then waits for the necessary requirements to actually perform the connection
     * or connects right away depending on the call type. (Jitsi, Legacy, ElementCall...)
     * It uses the media devices set in MediaDeviceHandler.
     * The widget associated with the call must be active
     * for this to succeed.
     * Only call this if the call state is: ConnectionState.Disconnected.
     */
    public async start(): Promise<void> {
        const { [MediaDeviceKindEnum.AudioInput]: audioInputs, [MediaDeviceKindEnum.VideoInput]: videoInputs } =
            (await MediaDeviceHandler.getDevices())!;

        let audioInput: MediaDeviceInfo | null = null;
        if (!MediaDeviceHandler.startWithAudioMuted) {
            const deviceId = MediaDeviceHandler.getAudioInput();
            audioInput = audioInputs.find((d) => d.deviceId === deviceId) ?? audioInputs[0] ?? null;
        }
        let videoInput: MediaDeviceInfo | null = null;
        if (!MediaDeviceHandler.startWithVideoMuted) {
            const deviceId = MediaDeviceHandler.getVideoInput();
            videoInput = videoInputs.find((d) => d.deviceId === deviceId) ?? videoInputs[0] ?? null;
        }

        const messagingStore = WidgetMessagingStore.instance;
        this.messaging = messagingStore.getMessagingForUid(this.widgetUid) ?? null;
        if (!this.messaging) {
            // The widget might still be initializing, so wait for it.
            try {
                await waitForEvent(
                    messagingStore,
                    WidgetMessagingStoreEvent.StoreMessaging,
                    (uid: string, widgetApi: ClientWidgetApi) => {
                        if (uid === this.widgetUid) {
                            this.messaging = widgetApi;
                            return true;
                        }
                        return false;
                    },
                );
            } catch (e) {
                throw new Error(`Failed to bind call widget in room ${this.roomId}: ${e}`);
            }
        }
        await this.performConnection(audioInput, videoInput);

        this.room.on(RoomEvent.MyMembership, this.onMyMembership);
        window.addEventListener("beforeunload", this.beforeUnload);
        this.connectionState = ConnectionState.Connected;
    }

    /**
     * Disconnects the user from the call.
     */
    public async disconnect(): Promise<void> {
        if (!this.connected) throw new Error("Not connected");

        this.connectionState = ConnectionState.Disconnecting;
        await this.performDisconnection();
        this.setDisconnected();
        this.close();
    }

    /**
     * Manually marks the call as disconnected.
     */
    public setDisconnected(): void {
        this.room.off(RoomEvent.MyMembership, this.onMyMembership);
        window.removeEventListener("beforeunload", this.beforeUnload);
        this.connectionState = ConnectionState.Disconnected;
    }

    /**
     * Stops further communication with the widget and tells the UI to close.
     */
    protected close(): void {
        this.messaging = null;
        this.emit(CallEvent.Close);
    }

    /**
     * Stops all internal timers and tasks to prepare for garbage collection.
     */
    public destroy(): void {
        if (this.connected) {
            this.setDisconnected();
            this.close();
        }
        WidgetMessagingStore.instance.off(WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
        this.emit(CallEvent.Destroy);
    }

    private readonly onMyMembership = async (_room: Room, membership: Membership): Promise<void> => {
        if (membership !== KnownMembership.Join) this.setDisconnected();
    };

    private readonly onStopMessaging = (uid: string): void => {
        if (uid === this.widgetUid && this.connected) {
            logger.log("The widget died; treating this as a user hangup");
            this.setDisconnected();
            this.close();
        }
    };

    private beforeUnload = (): void => {
        this.setDisconnected();
        this.close();
    };
}

export type { JitsiCallMemberContent };

/**
 * A group call using Jitsi as a backend.
 */
export class JitsiCall extends Call {
    public static readonly MEMBER_EVENT_TYPE = JitsiCallMemberEventType;
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private resendDevicesTimer: number | null = null;
    private participantsExpirationTimer: number | null = null;

    private constructor(widget: IApp, client: MatrixClient) {
        super(widget, client);

        this.room.on(RoomStateEvent.Update, this.onRoomState);
        this.on(CallEvent.ConnectionState, this.onConnectionState);
        this.updateParticipants();
    }

    public static get(room: Room): JitsiCall | null {
        // Only supported in video rooms
        if (room.isElementVideoRoom()) {
            const apps = WidgetStore.instance.getApps(room.roomId);
            // The isVideoChannel field differentiates rich Jitsi calls from bare Jitsi widgets
            const jitsiWidget = apps.find((app) => WidgetType.JITSI.matches(app.type) && app.data?.isVideoChannel);
            if (jitsiWidget) return new JitsiCall(jitsiWidget, room.client);
        }

        return null;
    }

    public static async create(room: Room): Promise<void> {
        await WidgetUtils.addJitsiWidget(room.client, room.roomId, CallType.Video, "Group call", true, room.name);
    }

    private updateParticipants(): void {
        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }

        const participants = new Map<RoomMember, Set<string>>();
        const now = Date.now();
        let allExpireAt = Infinity;

        for (const e of this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE)) {
            const member = this.room.getMember(e.getStateKey()!);
            const content = e.getContent<JitsiCallMemberContent>();
            const expiresAt = typeof content.expires_ts === "number" ? content.expires_ts : -Infinity;
            let devices =
                expiresAt > now && Array.isArray(content.devices)
                    ? content.devices.filter((d) => typeof d === "string")
                    : [];

            // Apply local echo for the disconnected case
            if (!this.connected && member?.userId === this.client.getUserId()) {
                devices = devices.filter((d) => d !== this.client.getDeviceId());
            }
            // Must have a connected device and still be joined to the room
            if (devices.length > 0 && member?.membership === KnownMembership.Join) {
                participants.set(member, new Set(devices));
                if (expiresAt < allExpireAt) allExpireAt = expiresAt;
            }
        }

        // Apply local echo for the connected case
        if (this.connected) {
            const localMember = this.room.getMember(this.client.getUserId()!)!;
            let devices = participants.get(localMember);
            if (devices === undefined) {
                devices = new Set();
                participants.set(localMember, devices);
            }

            devices.add(this.client.getDeviceId()!);
        }

        this.participants = participants;
        if (allExpireAt < Infinity) {
            this.participantsExpirationTimer = window.setTimeout(() => this.updateParticipants(), allExpireAt - now);
        }
    }

    /**
     * Updates our member state with the devices returned by the given function.
     * @param fn A function from the current devices to the new devices. If it
     *     returns null, the update is skipped.
     */
    private async updateDevices(fn: (devices: string[]) => string[] | null): Promise<void> {
        if (this.room.getMyMembership() !== KnownMembership.Join) return;

        const event = this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, this.client.getUserId()!);
        const content = event?.getContent<JitsiCallMemberContent>();
        const expiresAt = typeof content?.expires_ts === "number" ? content.expires_ts : -Infinity;
        const devices = expiresAt > Date.now() && Array.isArray(content?.devices) ? content!.devices : [];
        const newDevices = fn(devices);

        if (newDevices !== null) {
            const newContent: JitsiCallMemberContent = {
                devices: newDevices,
                expires_ts: Date.now() + this.STUCK_DEVICE_TIMEOUT_MS,
            };

            await this.client.sendStateEvent(
                this.roomId,
                JitsiCall.MEMBER_EVENT_TYPE,
                newContent,
                this.client.getUserId()!,
            );
        }
    }

    public async clean(): Promise<void> {
        const now = Date.now();
        const { devices: myDevices } = await this.client.getDevices();
        const deviceMap = new Map<string, IMyDevice>(myDevices.map((d) => [d.device_id, d]));

        // Clean up our member state by filtering out logged out devices,
        // inactive devices, and our own device (if we're disconnected)
        await this.updateDevices((devices) => {
            const newDevices = devices.filter((d) => {
                const device = deviceMap.get(d);
                return (
                    device?.last_seen_ts !== undefined &&
                    !(d === this.client.getDeviceId() && !this.connected) &&
                    now - device.last_seen_ts < this.STUCK_DEVICE_TIMEOUT_MS
                );
            });

            // Skip the update if the devices are unchanged
            return newDevices.length === devices.length ? null : newDevices;
        });
    }

    private async addOurDevice(): Promise<void> {
        await this.updateDevices((devices) => Array.from(new Set(devices).add(this.client.getDeviceId()!)));
    }

    private async removeOurDevice(): Promise<void> {
        await this.updateDevices((devices) => {
            const devicesSet = new Set(devices);
            devicesSet.delete(this.client.getDeviceId()!);
            return Array.from(devicesSet);
        });
    }

    protected async performConnection(
        audioInput: MediaDeviceInfo | null,
        videoInput: MediaDeviceInfo | null,
    ): Promise<void> {
        // Ensure that the messaging doesn't get stopped while we're waiting for responses
        const dontStopMessaging = new Promise<void>((resolve, reject) => {
            const messagingStore = WidgetMessagingStore.instance;

            const listener = (uid: string): void => {
                if (uid === this.widgetUid) {
                    cleanup();
                    reject(new Error("Messaging stopped"));
                }
            };
            const done = (): void => {
                cleanup();
                resolve();
            };
            const cleanup = (): void => {
                messagingStore.off(WidgetMessagingStoreEvent.StopMessaging, listener);
                this.off(CallEvent.ConnectionState, done);
            };

            messagingStore.on(WidgetMessagingStoreEvent.StopMessaging, listener);
            this.on(CallEvent.ConnectionState, done);
        });

        // Empirically, it's possible for Jitsi Meet to crash instantly at startup,
        // sending a hangup event that races with the rest of this method, so we need
        // to add the hangup listener now rather than later
        this.messaging!.on(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);

        // Actually perform the join
        const response = waitForEvent(
            this.messaging!,
            `action:${ElementWidgetActions.JoinCall}`,
            (ev: CustomEvent<IWidgetApiRequest>) => {
                ev.preventDefault();
                this.messaging!.transport.reply(ev.detail, {}); // ack
                return true;
            },
        );
        const request = this.messaging!.transport.send(ElementWidgetActions.JoinCall, {
            audioInput: audioInput?.label ?? null,
            videoInput: videoInput?.label ?? null,
        });
        try {
            await Promise.race([Promise.all([request, response]), dontStopMessaging]);
        } catch (e) {
            // If it timed out, clean up our advance preparations
            this.messaging!.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);

            if (this.messaging!.transport.ready) {
                // The messaging still exists, which means Jitsi might still be going in the background
                this.messaging!.transport.send(ElementWidgetActions.HangupCall, { force: true });
            }

            throw new Error(`Failed to join call in room ${this.roomId}: ${e}`);
        }

        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Dock, this.onDock);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Undock, this.onUndock);
    }

    protected async performDisconnection(): Promise<void> {
        const response = waitForEvent(
            this.messaging!,
            `action:${ElementWidgetActions.HangupCall}`,
            (ev: CustomEvent<IWidgetApiRequest>) => {
                ev.preventDefault();
                this.messaging!.transport.reply(ev.detail, {}); // ack
                return true;
            },
        );
        const request = this.messaging!.transport.send(ElementWidgetActions.HangupCall, {});
        try {
            await Promise.all([request, response]);
        } catch (e) {
            throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
        }
    }

    public setDisconnected(): void {
        // During tests this.messaging can be undefined
        this.messaging?.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onDock);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onUndock);

        super.setDisconnected();
    }

    public destroy(): void {
        this.room.off(RoomStateEvent.Update, this.onRoomState);
        this.on(CallEvent.ConnectionState, this.onConnectionState);
        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }
        if (this.resendDevicesTimer !== null) {
            clearInterval(this.resendDevicesTimer);
            this.resendDevicesTimer = null;
        }

        super.destroy();
    }

    private readonly onRoomState = (): void => this.updateParticipants();

    private readonly onConnectionState = async (state: ConnectionState, prevState: ConnectionState): Promise<void> => {
        if (state === ConnectionState.Connected && !isConnected(prevState)) {
            this.updateParticipants(); // Local echo

            // Tell others that we're connected, by adding our device to room state
            await this.addOurDevice();
            // Re-add this device every so often so our video member event doesn't become stale
            this.resendDevicesTimer = window.setInterval(
                async (): Promise<void> => {
                    logger.log(`Resending video member event for ${this.roomId}`);
                    await this.addOurDevice();
                },
                (this.STUCK_DEVICE_TIMEOUT_MS * 3) / 4,
            );
        } else if (state === ConnectionState.Disconnected && isConnected(prevState)) {
            this.updateParticipants(); // Local echo

            if (this.resendDevicesTimer !== null) {
                clearInterval(this.resendDevicesTimer);
                this.resendDevicesTimer = null;
            }
            // Tell others that we're disconnected, by removing our device from room state
            await this.removeOurDevice();
        }
    };

    private readonly onDock = async (): Promise<void> => {
        // The widget is no longer a PiP, so let's restore the default layout
        await this.messaging!.transport.send(ElementWidgetActions.TileLayout, {});
    };

    private readonly onUndock = async (): Promise<void> => {
        // The widget has become a PiP, so let's switch Jitsi to spotlight mode
        // to only show the active speaker and economize on space
        await this.messaging!.transport.send(ElementWidgetActions.SpotlightLayout, {});
    };

    private readonly onHangup = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
        // If we're already in the middle of a client-initiated disconnection,
        // ignore the event
        if (this.connectionState === ConnectionState.Disconnecting) return;

        ev.preventDefault();

        // In case this hangup is caused by Jitsi Meet crashing at startup,
        // wait for the connection event in order to avoid racing
        if (this.connectionState === ConnectionState.Disconnected) {
            await waitForEvent(this, CallEvent.ConnectionState);
        }

        this.messaging!.transport.reply(ev.detail, {}); // ack
        this.setDisconnected();
        this.close();
        // In video rooms we immediately want to restart the call after hangup
        // The lobby will be shown again and it connects to all signals from Jitsi.
        if (isVideoRoom(this.room)) {
            this.start();
        }
    };
}

/**
 * A group call using MSC3401 and Element Call as a backend.
 * (somewhat cheekily named)
 */
export class ElementCall extends Call {
    // TODO this is only there to support backwards compatibility in timeline rendering
    // this should not be part of this class since it has nothing to do with it.
    public static readonly CALL_EVENT_TYPE = new NamespacedValue(null, EventType.GroupCallPrefix);
    public static readonly MEMBER_EVENT_TYPE = new NamespacedValue(null, EventType.GroupCallMemberPrefix);
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private settingsStoreCallEncryptionWatcher?: string;
    private terminationTimer?: number;
    private _layout = Layout.Tile;
    public get layout(): Layout {
        return this._layout;
    }
    protected set layout(value: Layout) {
        this._layout = value;
        this.emit(CallEvent.Layout, value);
    }

    public get presented(): boolean {
        return super.presented;
    }
    public set presented(value: boolean) {
        super.presented = value;
        this.checkDestroy();
    }

    private static generateWidgetUrl(client: MatrixClient, roomId: string): URL {
        const baseUrl = window.location.href;
        let url = new URL("./widgets/element-call/index.html#", baseUrl); // this strips hash fragment from baseUrl

        const elementCallUrl = SettingsStore.getValue("Developer.elementCallUrl");
        if (elementCallUrl) url = new URL(elementCallUrl);

        // Splice together the Element Call URL for this call
        const params = new URLSearchParams({
            embed: "true", // We're embedding EC within another application
            // Template variables are used, so that this can be configured using the widget data.
            preload: "$preload", // We want it to load in the background.
            skipLobby: "$skipLobby", // Skip the lobby in case we show a lobby component of our own.
            returnToLobby: "$returnToLobby", // Returns to the lobby (instead of blank screen) when the call ends. (For video rooms)
            perParticipantE2EE: "$perParticipantE2EE",
            hideHeader: "true", // Hide the header since our room header is enough
            userId: client.getUserId()!,
            deviceId: client.getDeviceId()!,
            roomId: roomId,
            baseUrl: client.baseUrl,
            lang: getCurrentLanguage().replace("_", "-"),
            fontScale: (FontWatcher.getRootFontSize() / FontWatcher.getBrowserDefaultFontSize()).toString(),
            theme: "$org.matrix.msc2873.client_theme",
        });

        const rageshakeSubmitUrl = SdkConfig.get("bug_report_endpoint_url");
        if (rageshakeSubmitUrl) {
            params.append("rageshakeSubmitUrl", rageshakeSubmitUrl);
        }

        const posthogConfig = SdkConfig.get("posthog");
        if (posthogConfig && PosthogAnalytics.instance.getAnonymity() !== Anonymity.Disabled) {
            const accountAnalyticsData = client.getAccountData(PosthogAnalytics.ANALYTICS_EVENT_TYPE)?.getContent();
            // The analyticsID is passed directly to element call (EC) since this codepath is only for EC and no other widget.
            // We really don't want the same analyticID's for the EC and EW posthog instances (Data on posthog should be limited/anonymized as much as possible).
            // This is prohibited in EC where a hashed version of the analyticsID is used for the actual posthog identification.
            // We can pass the raw EW analyticsID here since we need to trust EC with not sending sensitive data to posthog (EC has access to more sensible data than the analyticsID e.g. the username)
            const analyticsID: string = accountAnalyticsData?.pseudonymousAnalyticsOptIn
                ? accountAnalyticsData?.id
                : "";

            params.append("analyticsID", analyticsID); // Legacy, deprecated in favour of posthogUserId
            params.append("posthogUserId", analyticsID);
            params.append("posthogApiHost", posthogConfig.api_host);
            params.append("posthogApiKey", posthogConfig.project_api_key);

            // We gate passing sentry behind analytics consent as EC shares data automatically without user-consent,
            // unlike EW where data is shared upon an intentional user action (rageshake).
            const sentryConfig = SdkConfig.get("sentry");
            if (sentryConfig) {
                params.append("sentryDsn", sentryConfig.dsn);
                params.append("sentryEnvironment", sentryConfig.environment ?? "");
            }
        }

        if (SettingsStore.getValue("fallbackICEServerAllowed")) {
            params.append("allowIceFallback", "true");
        }
        if (SettingsStore.getValue("feature_allow_screen_share_only_mode")) {
            params.append("allowVoipWithNoMedia", "true");
        }

        // Set custom fonts
        if (SettingsStore.getValue("useSystemFont")) {
            SettingsStore.getValue("systemFont")
                .split(",")
                .map((font) => {
                    // Strip whitespace and quotes
                    font = font.trim();
                    if (font.startsWith('"') && font.endsWith('"')) font = font.slice(1, -1);
                    return font;
                })
                .forEach((font) => params.append("font", font));
        }

        const replacedUrl = params.toString().replace(/%24/g, "$");
        url.hash = `#?${replacedUrl}`;
        return url;
    }

    // Creates a new widget if there isn't any widget of typ Call in this room.
    // Defaults for creating a new widget are: skipLobby = false, preload = false
    // When there is already a widget the current widget configuration will be used or can be overwritten
    // by passing the according parameters (skipLobby, preload).
    //
    // `preload` is deprecated. We used it for optimizing EC by using a custom EW call lobby and preloading the iframe.
    // now it should always be false.
    private static createOrGetCallWidget(
        roomId: string,
        client: MatrixClient,
        skipLobby: boolean | undefined,
        preload: boolean | undefined,
        returnToLobby: boolean | undefined,
    ): IApp {
        const ecWidget = WidgetStore.instance.getApps(roomId).find((app) => WidgetType.CALL.matches(app.type));
        if (ecWidget) {
            // Always update the widget data because even if the widget is already created,
            // we might have settings changes that update the widget.
            const overwrites: IWidgetData = {};
            if (skipLobby !== undefined) {
                overwrites.skipLobby = skipLobby;
            }
            if (preload !== undefined) {
                overwrites.preload = preload;
            }
            if (returnToLobby !== undefined) {
                overwrites.returnToLobby = returnToLobby;
            }
            ecWidget.data = ElementCall.getWidgetData(client, roomId, ecWidget?.data ?? {}, overwrites);
            return ecWidget;
        }

        // To use Element Call without touching room state, we create a virtual
        // widget (one that doesn't have a corresponding state event)
        const url = ElementCall.generateWidgetUrl(client, roomId);
        const createdWidget = WidgetStore.instance.addVirtualWidget(
            {
                id: secureRandomString(24), // So that it's globally unique
                creatorUserId: client.getUserId()!,
                name: "Element Call",
                type: WidgetType.CALL.preferred,
                url: url.toString(),
                waitForIframeLoad: false,
                data: ElementCall.getWidgetData(
                    client,
                    roomId,
                    {},
                    {
                        skipLobby: skipLobby ?? false,
                        preload: preload ?? false,
                        returnToLobby: returnToLobby ?? false,
                    },
                ),
            },
            roomId,
        );
        WidgetStore.instance.emit(UPDATE_EVENT, null);
        return createdWidget;
    }

    private static getWidgetData(
        client: MatrixClient,
        roomId: string,
        currentData: IWidgetData,
        overwriteData: IWidgetData,
    ): IWidgetData {
        let perParticipantE2EE = false;
        if (
            client.getRoom(roomId)?.hasEncryptionStateEvent() &&
            !SettingsStore.getValue("feature_disable_call_per_sender_encryption")
        )
            perParticipantE2EE = true;
        return {
            ...currentData,
            ...overwriteData,
            perParticipantE2EE,
        };
    }

    private onCallEncryptionSettingsChange(): void {
        this.widget.data = ElementCall.getWidgetData(this.client, this.roomId, this.widget.data ?? {}, {});
    }

    private constructor(
        public session: MatrixRTCSession,
        widget: IApp,
        client: MatrixClient,
    ) {
        super(widget, client);

        this.session.on(MatrixRTCSessionEvent.MembershipsChanged, this.onMembershipChanged);
        this.client.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, this.checkDestroy);
        SettingsStore.watchSetting(
            "feature_disable_call_per_sender_encryption",
            null,
            this.onCallEncryptionSettingsChange.bind(this),
        );
        this.updateParticipants();
    }

    public static get(room: Room): ElementCall | null {
        const apps = WidgetStore.instance.getApps(room.roomId);
        const hasEcWidget = apps.some((app) => WidgetType.CALL.matches(app.type));
        const session = room.client.matrixRTC.getRoomSession(room);

        // A call is present if we
        // - have a widget: This means the create function was called.
        // - or there is a running session where we have not yet created a widget for.
        // - or this is a call room. Then we also always want to show a call.
        if (hasEcWidget || session.memberships.length !== 0 || room.isCallRoom()) {
            // create a widget for the case we are joining a running call and don't have on yet.
            const availableOrCreatedWidget = ElementCall.createOrGetCallWidget(
                room.roomId,
                room.client,
                undefined,
                undefined,
                isVideoRoom(room),
            );
            return new ElementCall(session, availableOrCreatedWidget, room.client);
        }

        return null;
    }

    public static create(room: Room, skipLobby = false): void {
        ElementCall.createOrGetCallWidget(room.roomId, room.client, skipLobby, false, isVideoRoom(room));
    }

    protected async sendCallNotify(): Promise<void> {
        const room = this.room;
        const existingOtherRoomCallMembers = MatrixRTCSession.callMembershipsForRoom(room).filter(
            // filter all memberships where the application is m.call and the call_id is ""
            (m) => {
                const isRoomCallMember = m.application === "m.call" && m.callId === "";
                const isThisDevice = m.deviceId === this.client.deviceId;
                return isRoomCallMember && !isThisDevice;
            },
        );

        const memberCount = getJoinedNonFunctionalMembers(room).length;
        if (!isVideoRoom(room) && existingOtherRoomCallMembers.length === 0) {
            // send ringing event
            const content: ICallNotifyContent = {
                "application": "m.call",
                "m.mentions": { user_ids: [], room: true },
                "notify_type": memberCount == 2 ? "ring" : "notify",
                "call_id": "",
            };

            await room.client.sendEvent(room.roomId, EventType.CallNotify, content);
        }
    }

    protected async performConnection(
        audioInput: MediaDeviceInfo | null,
        videoInput: MediaDeviceInfo | null,
    ): Promise<void> {
        // The JoinCall action is only send if the widget is waiting for it.
        if (this.widget.data?.preload) {
            try {
                await this.messaging!.transport.send(ElementWidgetActions.JoinCall, {
                    audioInput: audioInput?.label ?? null,
                    videoInput: videoInput?.label ?? null,
                });
            } catch (e) {
                throw new Error(`Failed to join call in room ${this.roomId}: ${e}`);
            }
        }
        this.messaging!.on(`action:${ElementWidgetActions.TileLayout}`, this.onTileLayout);
        this.messaging!.on(`action:${ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
        this.messaging!.on(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.messaging!.once(`action:${ElementWidgetActions.Close}`, this.onClose);
        this.messaging!.on(`action:${ElementWidgetActions.DeviceMute}`, this.onDeviceMute);

        // TODO: if the widget informs us when the join button is clicked (widget action), so we can
        // - set state to connecting
        // - send call notify
        const session = this.client.matrixRTC.getActiveRoomSession(this.room);
        if (session) {
            await waitForEvent(
                session,
                MatrixRTCSessionEvent.MembershipsChanged,
                (_, newMemberships: CallMembership[]) =>
                    newMemberships.some((m) => m.sender === this.client.getUserId()),
                false, // allow user to wait as long as they want (no timeout)
            );
        } else {
            await waitForEvent(
                this.client.matrixRTC,
                MatrixRTCSessionManagerEvents.SessionStarted,
                (roomId: string, session: MatrixRTCSession) =>
                    this.session.callId === session.callId && roomId === this.roomId,
                false, // allow user to wait as long as they want (no timeout)
            );
        }
        this.sendCallNotify();
    }

    protected async performDisconnection(): Promise<void> {
        try {
            await this.messaging!.transport.send(ElementWidgetActions.HangupCall, {});
            await waitForEvent(
                this.session,
                MatrixRTCSessionEvent.MembershipsChanged,
                (_, newMemberships: CallMembership[]) =>
                    !newMemberships.some((m) => m.sender === this.client.getUserId()),
            );
        } catch (e) {
            throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
        }
    }

    public setDisconnected(): void {
        this.messaging!.off(`action:${ElementWidgetActions.TileLayout}`, this.onTileLayout);
        this.messaging!.off(`action:${ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
        this.messaging!.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.messaging!.off(`action:${ElementWidgetActions.DeviceMute}`, this.onDeviceMute);
        super.setDisconnected();
    }

    public destroy(): void {
        ActiveWidgetStore.instance.destroyPersistentWidget(this.widget.id, this.widget.roomId);
        WidgetStore.instance.removeVirtualWidget(this.widget.id, this.widget.roomId);
        this.session.off(MatrixRTCSessionEvent.MembershipsChanged, this.onMembershipChanged);
        this.client.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionEnded, this.checkDestroy);

        SettingsStore.unwatchSetting(this.settingsStoreCallEncryptionWatcher);
        clearTimeout(this.terminationTimer);
        this.terminationTimer = undefined;

        super.destroy();
    }

    private checkDestroy = (): void => {
        // A call ceases to exist as soon as all participants leave and also the
        // user isn't looking at it (for example, waiting in an empty lobby)
        if (this.session.memberships.length === 0 && !this.presented && !this.room.isCallRoom()) this.destroy();
    };

    /**
     * Sets the call's layout.
     * @param layout The layout to switch to.
     */
    public async setLayout(layout: Layout): Promise<void> {
        const action = layout === Layout.Tile ? ElementWidgetActions.TileLayout : ElementWidgetActions.SpotlightLayout;
        await this.messaging!.transport.send(action, {});
    }

    private readonly onMembershipChanged = (): void => this.updateParticipants();

    private updateParticipants(): void {
        const participants = new Map<RoomMember, Set<string>>();

        for (const m of this.session.memberships) {
            if (!m.sender) continue;
            const member = this.room.getMember(m.sender);
            if (member) {
                if (participants.has(member)) {
                    participants.get(member)?.add(m.deviceId);
                } else {
                    participants.set(member, new Set([m.deviceId]));
                }
            }
        }

        this.participants = participants;
    }

    private readonly onDeviceMute = (ev: CustomEvent<IWidgetApiRequest>): void => {
        ev.preventDefault();
        this.messaging!.transport.reply(ev.detail, {}); // ack
    };

    private readonly onHangup = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
        ev.preventDefault();
        this.messaging!.transport.reply(ev.detail, {}); // ack
        this.setDisconnected();
        // In video rooms we immediately want to reconnect after hangup
        // This starts the lobby again and connects to all signals from EC.
        if (isVideoRoom(this.room)) {
            this.start();
        }
    };

    private readonly onClose = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
        ev.preventDefault();
        this.messaging!.transport.reply(ev.detail, {}); // ack
        // User is done with the call; tell the UI to close it
        this.close();
    };

    private readonly onTileLayout = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
        ev.preventDefault();
        this.layout = Layout.Tile;
        this.messaging!.transport.reply(ev.detail, {}); // ack
    };

    private readonly onSpotlightLayout = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
        ev.preventDefault();
        this.layout = Layout.Spotlight;
        this.messaging!.transport.reply(ev.detail, {}); // ack
    };

    public clean(): Promise<void> {
        return Promise.resolve();
    }
}
