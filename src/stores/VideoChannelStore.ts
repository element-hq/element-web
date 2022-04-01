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

import { EventEmitter } from "events";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientWidgetApi, IWidgetApiRequest } from "matrix-widget-api";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { ElementWidgetActions } from "./widgets/ElementWidgetActions";
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "./ActiveWidgetStore";
import {
    VIDEO_CHANNEL,
    VIDEO_CHANNEL_MEMBER,
    IVideoChannelMemberContent,
    getVideoChannel,
} from "../utils/VideoChannelUtils";
import WidgetUtils from "../utils/WidgetUtils";

export enum VideoChannelEvent {
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

/*
 * Holds information about the currently active video channel.
 */
export default class VideoChannelStore extends EventEmitter {
    private static _instance: VideoChannelStore;

    public static get instance(): VideoChannelStore {
        if (!VideoChannelStore._instance) {
            VideoChannelStore._instance = new VideoChannelStore();
        }
        return VideoChannelStore._instance;
    }

    private readonly cli = MatrixClientPeg.get();
    private activeChannel: ClientWidgetApi;
    private _roomId: string;
    private _participants: IJitsiParticipant[];

    public get roomId(): string {
        return this._roomId;
    }

    public get participants(): IJitsiParticipant[] {
        return this._participants;
    }

    public start = () => {
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Update, this.onActiveWidgetUpdate);
    };

    public stop = () => {
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Update, this.onActiveWidgetUpdate);
    };

    private setConnected = async (roomId: string) => {
        const jitsi = getVideoChannel(roomId);
        if (!jitsi) throw new Error(`No video channel in room ${roomId}`);

        const messaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(jitsi));
        if (!messaging) throw new Error(`Failed to bind video channel in room ${roomId}`);

        this.activeChannel = messaging;
        this._roomId = roomId;
        this._participants = [];

        this.activeChannel.once(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.activeChannel.on(`action:${ElementWidgetActions.CallParticipants}`, this.onParticipants);

        this.emit(VideoChannelEvent.Connect);

        // Tell others that we're connected, by adding our device to room state
        await this.updateDevices(devices => Array.from(new Set(devices).add(this.cli.getDeviceId())));
    };

    private setDisconnected = async () => {
        this.activeChannel.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
        this.activeChannel.off(`action:${ElementWidgetActions.CallParticipants}`, this.onParticipants);

        this.activeChannel = null;
        this._participants = null;

        try {
            // Tell others that we're disconnected, by removing our device from room state
            await this.updateDevices(devices => {
                const devicesSet = new Set(devices);
                devicesSet.delete(this.cli.getDeviceId());
                return Array.from(devicesSet);
            });
        } finally {
            // Save this for last, since updateDevices needs the room ID
            this._roomId = null;
            this.emit(VideoChannelEvent.Disconnect);
        }
    };

    private ack = (ev: CustomEvent<IWidgetApiRequest>) => {
        // Even if we don't have a reply to a given widget action, we still need
        // to give the widget API something to acknowledge receipt
        this.activeChannel.transport.reply(ev.detail, {});
    };

    private updateDevices = async (fn: (devices: string[]) => string[]) => {
        if (!this.roomId) {
            logger.error("Tried to update devices while disconnected");
            return;
        }

        const room = this.cli.getRoom(this.roomId);
        const devicesState = room.currentState.getStateEvents(VIDEO_CHANNEL_MEMBER, this.cli.getUserId());
        const devices = devicesState?.getContent<IVideoChannelMemberContent>()?.devices ?? [];

        await this.cli.sendStateEvent(
            this.roomId, VIDEO_CHANNEL_MEMBER, { devices: fn(devices) }, this.cli.getUserId(),
        );
    };

    private onHangup = async (ev: CustomEvent<IWidgetApiRequest>) => {
        this.ack(ev);
        await this.setDisconnected();
    };

    private onParticipants = (ev: CustomEvent<IWidgetApiRequest>) => {
        this._participants = ev.detail.data.participants as IJitsiParticipant[];
        this.emit(VideoChannelEvent.Participants, ev.detail.data.participants);
        this.ack(ev);
    };

    private onActiveWidgetUpdate = async () => {
        if (this.activeChannel) {
            // We got disconnected from the previous video channel, so clean up
            await this.setDisconnected();
        }

        // If the new active widget is a video channel, that means we joined
        if (ActiveWidgetStore.instance.getPersistentWidgetId() === VIDEO_CHANNEL) {
            await this.setConnected(ActiveWidgetStore.instance.getPersistentRoomId());
        }
    };
}
