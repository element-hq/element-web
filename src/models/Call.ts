/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";
import { logger } from "matrix-js-sdk/src/logger";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { RoomEvent } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { NamespacedValue } from "matrix-js-sdk/src/NamespacedValue";
import { IWidgetApiRequest, MatrixWidgetType } from "matrix-widget-api";

import type EventEmitter from "events";
import type { IMyDevice } from "matrix-js-sdk/src/client";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { Room } from "matrix-js-sdk/src/models/room";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import type { IApp } from "../stores/WidgetStore";
import SdkConfig, { DEFAULTS } from "../SdkConfig";
import SettingsStore from "../settings/SettingsStore";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../MediaDeviceHandler";
import { timeout } from "../utils/promise";
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetType } from "../widgets/WidgetType";
import { ElementWidgetActions } from "../stores/widgets/ElementWidgetActions";
import WidgetStore from "../stores/WidgetStore";
import { WidgetMessagingStore, WidgetMessagingStoreEvent } from "../stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../stores/ActiveWidgetStore";
import PlatformPeg from "../PlatformPeg";
import { getCurrentLanguage } from "../languageHandler";

const TIMEOUT_MS = 16000;

// Waits until an event is emitted satisfying the given predicate
const waitForEvent = async (
    emitter: EventEmitter,
    event: string,
    pred: (...args: any[]) => boolean = () => true,
): Promise<void> => {
    let listener: (...args: any[]) => void;
    const wait = new Promise<void>(resolve => {
        listener = (...args) => { if (pred(...args)) resolve(); };
        emitter.on(event, listener);
    });

    const timedOut = await timeout(wait, false, TIMEOUT_MS) === false;
    emitter.off(event, listener!);
    if (timedOut) throw new Error("Timed out");
};

export enum ConnectionState {
    Disconnected = "disconnected",
    Connecting = "connecting",
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
    Destroy = "destroy",
}

interface CallEventHandlerMap {
    [CallEvent.ConnectionState]: (state: ConnectionState, prevState: ConnectionState) => void;
    [CallEvent.Participants]: (participants: Set<RoomMember>, prevParticipants: Set<RoomMember>) => void;
    [CallEvent.Layout]: (layout: Layout) => void;
    [CallEvent.Destroy]: () => void;
}

/**
 * A group call accessed through a widget.
 */
export abstract class Call extends TypedEventEmitter<CallEvent, CallEventHandlerMap> {
    protected readonly widgetUid = WidgetUtils.getWidgetUid(this.widget);
    protected readonly room = this.client.getRoom(this.roomId)!;

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

    private _participants = new Set<RoomMember>();
    public get participants(): Set<RoomMember> {
        return this._participants;
    }
    protected set participants(value: Set<RoomMember>) {
        const prevValue = this._participants;
        this._participants = value;
        this.emit(CallEvent.Participants, value, prevValue);
    }

    constructor(
        /**
         * The widget used to access this call.
         */
        public readonly widget: IApp,
        protected readonly client: MatrixClient,
    ) {
        super();
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
     * Gets the connected devices associated with the given user in room state.
     * @param userId The user's ID.
     * @returns The IDs of the user's connected devices.
     */
    protected abstract getDevices(userId: string): string[];

    /**
     * Sets the connected devices associated with ourselves in room state.
     * @param devices The devices with which we're connected.
     */
    protected abstract setDevices(devices: string[]): Promise<void>;

    /**
     * Updates our member state with the devices returned by the given function.
     * @param fn A function from the current devices to the new devices. If it
     *     returns null, the update is skipped.
     */
    protected async updateDevices(fn: (devices: string[]) => (string[] | null)): Promise<void> {
        if (this.room.getMyMembership() !== "join") return;

        const devices = fn(this.getDevices(this.client.getUserId()!));
        if (devices) {
            await this.setDevices(devices);
        }
    }

    /**
     * Performs a routine check of the call's associated room state, cleaning up
     * any data left over from an unclean disconnection.
     */
    public async clean(): Promise<void> {
        const now = Date.now();
        const { devices: myDevices } = await this.client.getDevices();
        const deviceMap = new Map<string, IMyDevice>(myDevices.map(d => [d.device_id, d]));

        // Clean up our member state by filtering out logged out devices,
        // inactive devices, and our own device (if we're disconnected)
        await this.updateDevices(devices => {
            const newDevices = devices.filter(d => {
                const device = deviceMap.get(d);
                return device?.last_seen_ts !== undefined
                    && !(d === this.client.getDeviceId() && !this.connected)
                    && (now - device.last_seen_ts) < this.STUCK_DEVICE_TIMEOUT_MS;
            });

            // Skip the update if the devices are unchanged
            return newDevices.length === devices.length ? null : newDevices;
        });
    }

    protected async addOurDevice(): Promise<void> {
        await this.updateDevices(devices => Array.from(new Set(devices).add(this.client.getDeviceId())));
    }

    protected async removeOurDevice(): Promise<void> {
        await this.updateDevices(devices => {
            const devicesSet = new Set(devices);
            devicesSet.delete(this.client.getDeviceId());
            return Array.from(devicesSet);
        });
    }

    /**
     * Contacts the widget to connect to the call.
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
     * Connects the user to the call using the media devices set in
     * MediaDeviceHandler. The widget associated with the call must be active
     * for this to succeed.
     */
    public async connect(): Promise<void> {
        this.connectionState = ConnectionState.Connecting;

        const {
            [MediaDeviceKindEnum.AudioInput]: audioInputs,
            [MediaDeviceKindEnum.VideoInput]: videoInputs,
        } = await MediaDeviceHandler.getDevices();

        let audioInput: MediaDeviceInfo | null = null;
        if (!MediaDeviceHandler.startWithAudioMuted) {
            const deviceId = MediaDeviceHandler.getAudioInput();
            audioInput = audioInputs.find(d => d.deviceId === deviceId) ?? audioInputs[0] ?? null;
        }
        let videoInput: MediaDeviceInfo | null = null;
        if (!MediaDeviceHandler.startWithVideoMuted) {
            const deviceId = MediaDeviceHandler.getVideoInput();
            videoInput = videoInputs.find(d => d.deviceId === deviceId) ?? videoInputs[0] ?? null;
        }

        const messagingStore = WidgetMessagingStore.instance;
        this.messaging = messagingStore.getMessagingForUid(this.widgetUid);
        if (!this.messaging) {
            // The widget might still be initializing, so wait for it
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

        try {
            await this.performConnection(audioInput, videoInput);
        } catch (e) {
            this.connectionState = ConnectionState.Disconnected;
            throw e;
        }

        this.room.on(RoomEvent.MyMembership, this.onMyMembership);
        window.addEventListener("beforeunload", this.beforeUnload);
        this.connectionState = ConnectionState.Connected;
    }

    /**
     * Disconnects the user from the call.
     */
    public async disconnect(): Promise<void> {
        if (this.connectionState !== ConnectionState.Connected) throw new Error("Not connected");

        this.connectionState = ConnectionState.Disconnecting;
        await this.performDisconnection();
        this.setDisconnected();
    }

    /**
     * Manually marks the call as disconnected and cleans up.
     */
    public setDisconnected() {
        this.room.off(RoomEvent.MyMembership, this.onMyMembership);
        window.removeEventListener("beforeunload", this.beforeUnload);
        this.messaging = null;
        this.connectionState = ConnectionState.Disconnected;
    }

    /**
     * Stops all internal timers and tasks to prepare for garbage collection.
     */
    public destroy() {
        if (this.connected) this.setDisconnected();
        this.emit(CallEvent.Destroy);
    }

    private onMyMembership = async (_room: Room, membership: string) => {
        if (membership !== "join") this.setDisconnected();
    };

    private beforeUnload = () => this.setDisconnected();
}

export interface JitsiCallMemberContent {
    // Connected device IDs
    devices: string[];
    // Time at which this state event should be considered stale
    expires_ts: number;
}

/**
 * A group call using Jitsi as a backend.
 */
export class JitsiCall extends Call {
    public static readonly MEMBER_EVENT_TYPE = "io.element.video.member";
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
        if (SettingsStore.getValue("feature_video_rooms") && room.isElementVideoRoom()) {
            const apps = WidgetStore.instance.getApps(room.roomId);
            // The isVideoChannel field differentiates rich Jitsi calls from bare Jitsi widgets
            const jitsiWidget = apps.find(app => WidgetType.JITSI.matches(app.type) && app.data?.isVideoChannel);
            if (jitsiWidget) return new JitsiCall(jitsiWidget, room.client);
        }

        return null;
    }

    public static async create(room: Room): Promise<void> {
        await WidgetUtils.addJitsiWidget(room.roomId, CallType.Video, "Group call", true, room.name);
    }

    private updateParticipants() {
        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }

        const members = new Set<RoomMember>();
        const now = Date.now();
        let allExpireAt = Infinity;

        for (const e of this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE)) {
            const member = this.room.getMember(e.getStateKey()!);
            const content = e.getContent<JitsiCallMemberContent>();
            const expiresAt = typeof content.expires_ts === "number" ? content.expires_ts : -Infinity;
            let devices = expiresAt > now && Array.isArray(content.devices) ? content.devices : [];

            // Apply local echo for the disconnected case
            if (!this.connected && member?.userId === this.client.getUserId()) {
                devices = devices.filter(d => d !== this.client.getDeviceId());
            }
            // Must have a connected device and still be joined to the room
            if (devices.length && member?.membership === "join") {
                members.add(member);
                if (expiresAt < allExpireAt) allExpireAt = expiresAt;
            }
        }

        // Apply local echo for the connected case
        if (this.connected) members.add(this.room.getMember(this.client.getUserId()!)!);

        this.participants = members;
        if (allExpireAt < Infinity) {
            this.participantsExpirationTimer = setTimeout(() => this.updateParticipants(), allExpireAt - now);
        }
    }

    protected getDevices(userId: string): string[] {
        const event = this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, userId);
        const content = event?.getContent<JitsiCallMemberContent>();
        const expiresAt = typeof content?.expires_ts === "number" ? content.expires_ts : -Infinity;
        return expiresAt > Date.now() && Array.isArray(content?.devices) ? content.devices : [];
    }

    protected async setDevices(devices: string[]): Promise<void> {
        const content: JitsiCallMemberContent = {
            devices,
            expires_ts: Date.now() + this.STUCK_DEVICE_TIMEOUT_MS,
        };

        await this.client.sendStateEvent(
            this.roomId, JitsiCall.MEMBER_EVENT_TYPE, content, this.client.getUserId()!,
        );
    }

    protected async performConnection(
        audioInput: MediaDeviceInfo | null,
        videoInput: MediaDeviceInfo | null,
    ): Promise<void> {
        // Ensure that the messaging doesn't get stopped while we're waiting for responses
        const dontStopMessaging = new Promise<void>((resolve, reject) => {
            const messagingStore = WidgetMessagingStore.instance;

            const listener = (uid: string) => {
                if (uid === this.widgetUid) {
                    cleanup();
                    reject(new Error("Messaging stopped"));
                }
            };
            const done = () => {
                cleanup();
                resolve();
            };
            const cleanup = () => {
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

    public setDisconnected() {
        this.messaging!.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onDock);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onUndock);

        super.setDisconnected();
    }

    public destroy() {
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

    private onRoomState = () => this.updateParticipants();

    private onConnectionState = async (state: ConnectionState, prevState: ConnectionState) => {
        if (state === ConnectionState.Connected && !isConnected(prevState)) {
            this.updateParticipants(); // Local echo

            // Tell others that we're connected, by adding our device to room state
            await this.addOurDevice();
            // Re-add this device every so often so our video member event doesn't become stale
            this.resendDevicesTimer = setInterval(async () => {
                logger.log(`Resending video member event for ${this.roomId}`);
                await this.addOurDevice();
            }, (this.STUCK_DEVICE_TIMEOUT_MS * 3) / 4);
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

    private onDock = async () => {
        // The widget is no longer a PiP, so let's restore the default layout
        await this.messaging!.transport.send(ElementWidgetActions.TileLayout, {});
    };

    private onUndock = async () => {
        // The widget has become a PiP, so let's switch Jitsi to spotlight mode
        // to only show the active speaker and economize on space
        await this.messaging!.transport.send(ElementWidgetActions.SpotlightLayout, {});
    };

    private onHangup = async (ev: CustomEvent<IWidgetApiRequest>) => {
        // If we're already in the middle of a client-initiated disconnection,
        // ignore the event
        if (this.connectionState === ConnectionState.Disconnecting) return;

        ev.preventDefault();

        // In case this hangup is caused by Jitsi Meet crashing at startup,
        // wait for the connection event in order to avoid racing
        if (this.connectionState === ConnectionState.Connecting) {
            await waitForEvent(this, CallEvent.ConnectionState);
        }

        await this.messaging!.transport.reply(ev.detail, {}); // ack
        this.setDisconnected();
    };
}

export interface ElementCallMemberContent {
    "m.expires_ts": number;
    "m.calls": {
        "m.call_id": string;
        "m.devices": {
            device_id: string;
            session_id: string;
            feeds: unknown[]; // We don't care about what these are
        }[];
    }[];
}

/**
 * A group call using MSC3401 and Element Call as a backend.
 * (somewhat cheekily named)
 */
export class ElementCall extends Call {
    public static readonly CALL_EVENT_TYPE = new NamespacedValue(null, "org.matrix.msc3401.call");
    public static readonly MEMBER_EVENT_TYPE = new NamespacedValue(null, "org.matrix.msc3401.call.member");
    public static readonly DUPLICATE_CALL_DEVICE_EVENT_TYPE = "io.element.duplicate_call_device";
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private kickedOutByAnotherDevice = false;
    private connectionTime: number | null = null;
    private participantsExpirationTimer: number | null = null;
    private terminationTimer: number | null = null;

    private _layout = Layout.Tile;
    public get layout(): Layout {
        return this._layout;
    }
    protected set layout(value: Layout) {
        this._layout = value;
        this.emit(CallEvent.Layout, value);
    }

    private constructor(public readonly groupCall: MatrixEvent, client: MatrixClient) {
        // Splice together the Element Call URL for this call
        const url = new URL(SdkConfig.get("element_call").url ?? DEFAULTS.element_call.url!);
        url.pathname = "/room";
        const params = new URLSearchParams({
            embed: "",
            preload: "",
            hideHeader: "",
            userId: client.getUserId()!,
            deviceId: client.getDeviceId(),
            roomId: groupCall.getRoomId()!,
            baseUrl: client.baseUrl,
            lang: getCurrentLanguage().replace("_", "-"),
        });
        // Currently, the screen-sharing support is the same is it is for Jitsi
        if (!PlatformPeg.get().supportsJitsiScreensharing()) {
            params.append("hideScreensharing", "");
        }
        url.hash = `#?${params.toString()}`;

        // To use Element Call without touching room state, we create a virtual
        // widget (one that doesn't have a corresponding state event)
        super(
            WidgetStore.instance.addVirtualWidget({
                id: randomString(24), // So that it's globally unique
                creatorUserId: client.getUserId()!,
                name: "Element Call",
                type: MatrixWidgetType.Custom,
                url: url.toString(),
            }, groupCall.getRoomId()!),
            client,
        );

        this.room.on(RoomStateEvent.Update, this.onRoomState);
        this.on(CallEvent.ConnectionState, this.onConnectionState);
        this.on(CallEvent.Participants, this.onParticipants);
        this.updateParticipants();
    }

    public static get(room: Room): ElementCall | null {
        // Only supported in the new group call experience or in video rooms
        if (
            SettingsStore.getValue("feature_group_calls") || (
                SettingsStore.getValue("feature_video_rooms")
                && SettingsStore.getValue("feature_element_call_video_rooms")
                && room.isCallRoom()
            )
        ) {
            const groupCalls = ElementCall.CALL_EVENT_TYPE.names.flatMap(eventType =>
                room.currentState.getStateEvents(eventType),
            );

            // Find the newest unterminated call
            let groupCall: MatrixEvent | null = null;
            for (const event of groupCalls) {
                if (
                    !("m.terminated" in event.getContent())
                    && (groupCall === null || event.getTs() > groupCall.getTs())
                ) {
                    groupCall = event;
                }
            }

            if (groupCall !== null) return new ElementCall(groupCall, room.client);
        }

        return null;
    }

    public static async create(room: Room): Promise<void> {
        const isVideoRoom = SettingsStore.getValue("feature_video_rooms")
            && SettingsStore.getValue("feature_element_call_video_rooms")
            && room.isCallRoom();

        await room.client.sendStateEvent(room.roomId, ElementCall.CALL_EVENT_TYPE.name, {
            "m.intent": isVideoRoom ? "m.room" : "m.prompt",
            "m.type": "m.video",
        }, randomString(24));
    }

    private updateParticipants() {
        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }

        const members = new Set<RoomMember>();
        const now = Date.now();
        let allExpireAt = Infinity;

        const memberEvents = ElementCall.MEMBER_EVENT_TYPE.names.flatMap(eventType =>
            this.room.currentState.getStateEvents(eventType),
        );

        for (const e of memberEvents) {
            const member = this.room.getMember(e.getStateKey()!);
            const content = e.getContent<ElementCallMemberContent>();
            const expiresAt = typeof content["m.expires_ts"] === "number" ? content["m.expires_ts"] : -Infinity;
            const calls = expiresAt > now && Array.isArray(content["m.calls"]) ? content["m.calls"] : [];
            const call = calls.find(call => call["m.call_id"] === this.groupCall.getStateKey());
            let devices = Array.isArray(call?.["m.devices"]) ? call!["m.devices"] : [];

            // Apply local echo for the disconnected case
            if (!this.connected && member?.userId === this.client.getUserId()) {
                devices = devices.filter(d => d.device_id !== this.client.getDeviceId());
            }
            // Must have a connected device and still be joined to the room
            if (devices.length && member?.membership === "join") {
                members.add(member);
                if (expiresAt < allExpireAt) allExpireAt = expiresAt;
            }
        }

        // Apply local echo for the connected case
        if (this.connected) members.add(this.room.getMember(this.client.getUserId()!)!);

        this.participants = members;
        if (allExpireAt < Infinity) {
            this.participantsExpirationTimer = setTimeout(() => this.updateParticipants(), allExpireAt - now);
        }
    }

    private getCallsState(userId: string): ElementCallMemberContent["m.calls"] {
        const event = (() => {
            for (const eventType of ElementCall.MEMBER_EVENT_TYPE.names) {
                const e = this.room.currentState.getStateEvents(eventType, userId);
                if (e) return e;
            }
            return null;
        })();
        const content = event?.getContent<ElementCallMemberContent>();
        const expiresAt = typeof content?.["m.expires_ts"] === "number" ? content["m.expires_ts"] : -Infinity;
        return expiresAt > Date.now() && Array.isArray(content?.["m.calls"]) ? content!["m.calls"] : [];
    }

    protected getDevices(userId: string): string[] {
        const calls = this.getCallsState(userId);
        const call = calls.find(call => call["m.call_id"] === this.groupCall.getStateKey());
        const devices = Array.isArray(call?.["m.devices"]) ? call!["m.devices"] : [];
        return devices.map(d => d.device_id);
    }

    protected async setDevices(devices: string[]): Promise<void> {
        const calls = this.getCallsState(this.client.getUserId()!);
        const call = calls.find(c => c["m.call_id"] === this.groupCall.getStateKey())!;
        const prevDevices = Array.isArray(call?.["m.devices"]) ? call!["m.devices"] : [];
        const prevDevicesMap = new Map(prevDevices.map(d => [d.device_id, d]));

        const newContent: ElementCallMemberContent = {
            "m.expires_ts": Date.now() + this.STUCK_DEVICE_TIMEOUT_MS,
            "m.calls": [
                {
                    "m.call_id": this.groupCall.getStateKey()!,
                    // This method will only ever be used to remove devices, so
                    // it's safe to assume that all requested devices are
                    // present in the map
                    "m.devices": devices.map(d => prevDevicesMap.get(d)!),
                },
                ...calls.filter(c => c !== call),
            ],
        };

        await this.client.sendStateEvent(
            this.roomId, ElementCall.MEMBER_EVENT_TYPE.name, newContent, this.client.getUserId()!,
        );
    }

    protected async performConnection(
        audioInput: MediaDeviceInfo | null,
        videoInput: MediaDeviceInfo | null,
    ): Promise<void> {
        this.kickedOutByAnotherDevice = false;
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);

        this.connectionTime = Date.now();
        await this.client.sendToDevice(ElementCall.DUPLICATE_CALL_DEVICE_EVENT_TYPE, {
            [this.client.getUserId()]: {
                "*": { device_id: this.client.getDeviceId(), timestamp: this.connectionTime },
            },
        });

        try {
            await this.messaging!.transport.send(ElementWidgetActions.JoinCall, {
                audioInput: audioInput?.label ?? null,
                videoInput: videoInput?.label ?? null,
            });
        } catch (e) {
            throw new Error(`Failed to join call in room ${this.roomId}: ${e}`);
        }

        this.messaging!.on(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.messaging!.on(`action:${ElementWidgetActions.TileLayout}`, this.onTileLayout);
        this.messaging!.on(`action:${ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
    }

    protected async performDisconnection(): Promise<void> {
        try {
            await this.messaging!.transport.send(ElementWidgetActions.HangupCall, {});
        } catch (e) {
            throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
        }
    }

    public setDisconnected() {
        this.client.off(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
        this.messaging!.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.messaging!.on(`action:${ElementWidgetActions.TileLayout}`, this.onTileLayout);
        this.messaging!.on(`action:${ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
        super.setDisconnected();
    }

    public destroy() {
        WidgetStore.instance.removeVirtualWidget(this.widget.id, this.groupCall.getRoomId()!);
        this.room.off(RoomStateEvent.Update, this.onRoomState);
        this.off(CallEvent.ConnectionState, this.onConnectionState);
        this.off(CallEvent.Participants, this.onParticipants);

        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }
        if (this.terminationTimer !== null) {
            clearTimeout(this.terminationTimer);
            this.terminationTimer = null;
        }

        super.destroy();
    }

    /**
     * Sets the call's layout.
     * @param layout The layout to switch to.
     */
    public async setLayout(layout: Layout): Promise<void> {
        const action = layout === Layout.Tile
            ? ElementWidgetActions.TileLayout
            : ElementWidgetActions.SpotlightLayout;

        await this.messaging!.transport.send(action, {});
    }

    private get mayTerminate(): boolean {
        if (this.kickedOutByAnotherDevice) return false;
        if (this.groupCall.getContent()["m.intent"] === "m.room") return false;
        if (
            !this.room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, this.client)
        ) return false;

        return true;
    }

    private async terminate(): Promise<void> {
        await this.client.sendStateEvent(
            this.roomId,
            ElementCall.CALL_EVENT_TYPE.name,
            { ...this.groupCall.getContent(), "m.terminated": "Call ended" },
            this.groupCall.getStateKey(),
        );
    }

    private onRoomState = () => {
        this.updateParticipants();

        // Destroy the call if it's been terminated
        const newGroupCall = this.room.currentState.getStateEvents(
            this.groupCall.getType(), this.groupCall.getStateKey()!,
        );
        if ("m.terminated" in newGroupCall.getContent()) this.destroy();
    };

    private onToDeviceEvent = (event: MatrixEvent): void => {
        const content = event.getContent();
        if (event.getType() !== ElementCall.DUPLICATE_CALL_DEVICE_EVENT_TYPE) return;
        if (event.getSender() !== this.client.getUserId()) return;
        if (content.device_id === this.client.getDeviceId()) return;
        if (content.timestamp <= this.connectionTime) return;

        this.kickedOutByAnotherDevice = true;
        this.disconnect();
    };

    private onConnectionState = (state: ConnectionState, prevState: ConnectionState) => {
        if (
            (state === ConnectionState.Connected && !isConnected(prevState))
            || (state === ConnectionState.Disconnected && isConnected(prevState))
        ) {
            this.updateParticipants(); // Local echo
        }
    };

    private onParticipants = async (participants: Set<RoomMember>, prevParticipants: Set<RoomMember>) => {
        // If the last participant disconnected, terminate the call
        if (participants.size === 0 && prevParticipants.size > 0 && this.mayTerminate) {
            if (prevParticipants.has(this.room.getMember(this.client.getUserId()!)!)) {
                // If we were that last participant, do the termination ourselves
                await this.terminate();
            } else {
                // We don't appear to have been the last participant, but because of
                // the potential for races, users lacking permission, and a myriad of
                // other reasons, we can't rely on other clients to terminate the call.
                // Since it's likely that other clients are using this same logic, we wait
                // randomly between 2 and 8 seconds before terminating the call, to
                // probabilistically reduce event spam. If someone else beats us to it,
                // this timer will be automatically cleared upon the call's destruction.
                this.terminationTimer = setTimeout(() => this.terminate(), Math.random() * 6000 + 2000);
            }
        }
    };

    private onHangup = async (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        await this.messaging!.transport.reply(ev.detail, {}); // ack
        this.setDisconnected();
    };

    private onTileLayout = async (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.layout = Layout.Tile;
        await this.messaging!.transport.reply(ev.detail, {}); // ack
    };

    private onSpotlightLayout = async (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.layout = Layout.Spotlight;
        await this.messaging!.transport.reply(ev.detail, {}); // ack
    };
}
