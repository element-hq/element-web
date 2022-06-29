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

import EventEmitter from "events";
import { logger } from "matrix-js-sdk/src/logger";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { ClientWidgetApi, IWidgetApiRequest } from "matrix-widget-api";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { ElementWidgetActions } from "./widgets/ElementWidgetActions";
import { WidgetMessagingStore, WidgetMessagingStoreEvent } from "./widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "./ActiveWidgetStore";
import { STUCK_DEVICE_TIMEOUT_MS, getVideoChannel, addOurDevice, removeOurDevice } from "../utils/VideoChannelUtils";
import { timeout } from "../utils/promise";
import WidgetUtils from "../utils/WidgetUtils";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";

export enum VideoChannelEvent {
    StartConnect = "start_connect",
    Connect = "connect",
    Disconnect = "disconnect",
    Participants = "participants",
}

export interface IJitsiParticipant {
    avatarURL: string;
    displayName: string;
    formattedDisplayName: string;
    participantId: string;
}

const TIMEOUT_MS = 16000;

// Wait until an event is emitted satisfying the given predicate
const waitForEvent = async (emitter: EventEmitter, event: string, pred: (...args) => boolean = () => true) => {
    let listener;
    const wait = new Promise<void>(resolve => {
        listener = (...args) => { if (pred(...args)) resolve(); };
        emitter.on(event, listener);
    });

    const timedOut = await timeout(wait, false, TIMEOUT_MS) === false;
    emitter.off(event, listener);
    if (timedOut) throw new Error("Timed out");
};

/*
 * Holds information about the currently active video channel.
 */
export default class VideoChannelStore extends AsyncStoreWithClient<null> {
    private static _instance: VideoChannelStore;

    public static get instance(): VideoChannelStore {
        if (!VideoChannelStore._instance) {
            VideoChannelStore._instance = new VideoChannelStore();
        }
        return VideoChannelStore._instance;
    }

    private constructor() {
        super(defaultDispatcher);
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // nothing to do
    }

    private activeChannel: ClientWidgetApi;
    private resendDevicesTimer: number;

    // This is persisted to settings so we can detect unclean disconnects
    public get roomId(): string | null { return SettingsStore.getValue("videoChannelRoomId"); }
    private set roomId(value: string | null) {
        SettingsStore.setValue("videoChannelRoomId", null, SettingLevel.DEVICE, value);
    }

    private get room(): Room { return this.matrixClient.getRoom(this.roomId); }

    private _connected = false;
    public get connected(): boolean { return this._connected; }
    private set connected(value: boolean) { this._connected = value; }

    private _participants: IJitsiParticipant[] = [];
    public get participants(): IJitsiParticipant[] { return this._participants; }
    private set participants(value: IJitsiParticipant[]) { this._participants = value; }

    public get audioMuted(): boolean { return SettingsStore.getValue("audioInputMuted"); }
    public set audioMuted(value: boolean) {
        SettingsStore.setValue("audioInputMuted", null, SettingLevel.DEVICE, value);
    }

    public get videoMuted(): boolean { return SettingsStore.getValue("videoInputMuted"); }
    public set videoMuted(value: boolean) {
        SettingsStore.setValue("videoInputMuted", null, SettingLevel.DEVICE, value);
    }

    public connect = async (
        roomId: string,
        audioDevice: MediaDeviceInfo | null,
        videoDevice: MediaDeviceInfo | null,
    ) => {
        if (this.activeChannel) await this.disconnect();

        const jitsi = getVideoChannel(roomId);
        if (!jitsi) throw new Error(`No video channel in room ${roomId}`);

        const jitsiUid = WidgetUtils.getWidgetUid(jitsi);
        const messagingStore = WidgetMessagingStore.instance;

        let messaging = messagingStore.getMessagingForUid(jitsiUid);
        if (!messaging) {
            // The widget might still be initializing, so wait for it
            try {
                await waitForEvent(
                    messagingStore,
                    WidgetMessagingStoreEvent.StoreMessaging,
                    (uid: string, widgetApi: ClientWidgetApi) => {
                        if (uid === jitsiUid) {
                            messaging = widgetApi;
                            return true;
                        }
                        return false;
                    },
                );
            } catch (e) {
                throw new Error(`Failed to bind video channel in room ${roomId}: ${e}`);
            }
        }

        // Now that we got the messaging, we need a way to ensure that it doesn't get stopped
        const dontStopMessaging = new Promise<void>((resolve, reject) => {
            const listener = (uid: string) => {
                if (uid === jitsiUid) {
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
                this.off(VideoChannelEvent.Connect, done);
                this.off(VideoChannelEvent.Disconnect, done);
            };

            messagingStore.on(WidgetMessagingStoreEvent.StopMessaging, listener);
            this.on(VideoChannelEvent.Connect, done);
            this.on(VideoChannelEvent.Disconnect, done);
        });

        if (!messagingStore.isWidgetReady(jitsiUid)) {
            // Wait for the widget to be ready to receive our join event
            try {
                await Promise.race([
                    waitForEvent(
                        messagingStore,
                        WidgetMessagingStoreEvent.WidgetReady,
                        (uid: string) => uid === jitsiUid,
                    ),
                    dontStopMessaging,
                ]);
            } catch (e) {
                throw new Error(`Video channel in room ${roomId} never became ready: ${e}`);
            }
        }

        // Participant data and mute state will come down the event pipeline quickly, so prepare in advance
        this.activeChannel = messaging;
        this.roomId = roomId;
        messaging.on(`action:${ElementWidgetActions.CallParticipants}`, this.onParticipants);
        messaging.on(`action:${ElementWidgetActions.MuteAudio}`, this.onMuteAudio);
        messaging.on(`action:${ElementWidgetActions.UnmuteAudio}`, this.onUnmuteAudio);
        messaging.on(`action:${ElementWidgetActions.MuteVideo}`, this.onMuteVideo);
        messaging.on(`action:${ElementWidgetActions.UnmuteVideo}`, this.onUnmuteVideo);
        // Empirically, it's possible for Jitsi Meet to crash instantly at startup,
        // sending a hangup event that races with the rest of this method, so we also
        // need to add the hangup listener now rather than later
        messaging.once(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);

        this.emit(VideoChannelEvent.StartConnect, roomId);

        // Actually perform the join
        const waitForJoin = waitForEvent(
            messaging,
            `action:${ElementWidgetActions.JoinCall}`,
            (ev: CustomEvent<IWidgetApiRequest>) => {
                ev.preventDefault();
                this.ack(ev);
                return true;
            },
        );
        messaging.transport.send(ElementWidgetActions.JoinCall, {
            audioDevice: audioDevice?.label ?? null,
            videoDevice: videoDevice?.label ?? null,
        });
        try {
            await Promise.race([waitForJoin, dontStopMessaging]);
        } catch (e) {
            // If it timed out, clean up our advance preparations
            this.activeChannel = null;
            this.roomId = null;

            messaging.off(`action:${ElementWidgetActions.CallParticipants}`, this.onParticipants);
            messaging.off(`action:${ElementWidgetActions.MuteAudio}`, this.onMuteAudio);
            messaging.off(`action:${ElementWidgetActions.UnmuteAudio}`, this.onUnmuteAudio);
            messaging.off(`action:${ElementWidgetActions.MuteVideo}`, this.onMuteVideo);
            messaging.off(`action:${ElementWidgetActions.UnmuteVideo}`, this.onUnmuteVideo);
            messaging.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);

            if (messaging.transport.ready) {
                // The messaging still exists, which means Jitsi might still be going in the background
                messaging.transport.send(ElementWidgetActions.ForceHangupCall, {});
            }

            this.emit(VideoChannelEvent.Disconnect, roomId);

            throw new Error(`Failed to join call in room ${roomId}: ${e}`);
        }

        this.connected = true;
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Dock, this.onDock);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Undock, this.onUndock);
        this.room.on(RoomEvent.MyMembership, this.onMyMembership);
        window.addEventListener("beforeunload", this.setDisconnected);

        this.emit(VideoChannelEvent.Connect, roomId);

        // Tell others that we're connected, by adding our device to room state
        await addOurDevice(this.room);
        // Re-add this device every so often so our video member event doesn't become stale
        this.resendDevicesTimer = setInterval(async () => {
            logger.log(`Resending video member event for ${this.roomId}`);
            await addOurDevice(this.room);
        }, (STUCK_DEVICE_TIMEOUT_MS * 3) / 4);
    };

    public disconnect = async () => {
        if (!this.activeChannel) throw new Error("Not connected to any video channel");

        const waitForDisconnect = waitForEvent(this, VideoChannelEvent.Disconnect);
        this.activeChannel.transport.send(ElementWidgetActions.HangupCall, {});
        try {
            await waitForDisconnect; // onHangup cleans up for us
        } catch (e) {
            throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
        }
    };

    public setDisconnected = async () => {
        const roomId = this.roomId;
        const room = this.room;

        this.activeChannel.off(`action:${ElementWidgetActions.CallParticipants}`, this.onParticipants);
        this.activeChannel.off(`action:${ElementWidgetActions.MuteAudio}`, this.onMuteAudio);
        this.activeChannel.off(`action:${ElementWidgetActions.UnmuteAudio}`, this.onUnmuteAudio);
        this.activeChannel.off(`action:${ElementWidgetActions.MuteVideo}`, this.onMuteVideo);
        this.activeChannel.off(`action:${ElementWidgetActions.UnmuteVideo}`, this.onUnmuteVideo);
        this.activeChannel.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onDock);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onUndock);
        room.off(RoomEvent.MyMembership, this.onMyMembership);
        window.removeEventListener("beforeunload", this.setDisconnected);
        clearInterval(this.resendDevicesTimer);

        this.activeChannel = null;
        this.roomId = null;
        this.connected = false;
        this.participants = [];

        this.emit(VideoChannelEvent.Disconnect, roomId);

        // Tell others that we're disconnected, by removing our device from room state
        await removeOurDevice(room);
    };

    private ack = (ev: CustomEvent<IWidgetApiRequest>, messaging = this.activeChannel) => {
        // Even if we don't have a reply to a given widget action, we still need
        // to give the widget API something to acknowledge receipt
        messaging.transport.reply(ev.detail, {});
    };

    private onHangup = async (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        const messaging = this.activeChannel;
        // In case this hangup is caused by Jitsi Meet crashing at startup,
        // wait for the connection event in order to avoid racing
        if (!this.connected) await waitForEvent(this, VideoChannelEvent.Connect);
        await this.setDisconnected();
        this.ack(ev, messaging);
    };

    private onParticipants = (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.participants = ev.detail.data.participants as IJitsiParticipant[];
        this.emit(VideoChannelEvent.Participants, this.roomId, ev.detail.data.participants);
        this.ack(ev);
    };

    private onMuteAudio = (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.audioMuted = true;
        this.ack(ev);
    };

    private onUnmuteAudio = (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.audioMuted = false;
        this.ack(ev);
    };

    private onMuteVideo = (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.videoMuted = true;
        this.ack(ev);
    };

    private onUnmuteVideo = (ev: CustomEvent<IWidgetApiRequest>) => {
        ev.preventDefault();
        this.videoMuted = false;
        this.ack(ev);
    };

    private onMyMembership = (room: Room, membership: string) => {
        if (membership !== "join") this.setDisconnected();
    };

    private onDock = async () => {
        // The widget is no longer a PiP, so let's restore the default layout
        await this.activeChannel.transport.send(ElementWidgetActions.TileLayout, {});
    };

    private onUndock = async () => {
        // The widget has become a PiP, so let's switch Jitsi to spotlight mode
        // to only show the active speaker and economize on space
        await this.activeChannel.transport.send(ElementWidgetActions.SpotlightLayout, {});
    };
}
