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

import { useState, useMemo, useEffect } from "react";
import { throttle } from "lodash";
import { Optional } from "matrix-events-sdk";
import { logger } from "matrix-js-sdk/src/logger";
import { IMyDevice } from "matrix-js-sdk/src/client";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { useEventEmitter, useTypedEventEmitter } from "../hooks/useEventEmitter";
import WidgetStore, { IApp } from "../stores/WidgetStore";
import { WidgetType } from "../widgets/WidgetType";
import WidgetUtils from "./WidgetUtils";
import VideoChannelStore, { VideoChannelEvent, IJitsiParticipant } from "../stores/VideoChannelStore";

interface IVideoChannelMemberContent {
    // Connected device IDs
    devices: string[];
    // Time at which this state event should be considered stale
    expires_ts: number;
}

export const VIDEO_CHANNEL_MEMBER = "io.element.video.member";
export const STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

export enum ConnectionState {
    Disconnected = "disconnected",
    Connecting = "connecting",
    Connected = "connected",
}

export const getVideoChannel = (roomId: string): IApp => {
    const apps = WidgetStore.instance.getApps(roomId);
    return apps.find(app => WidgetType.JITSI.matches(app.type) && app.data.isVideoChannel);
};

export const addVideoChannel = async (roomId: string, roomName: string) => {
    await WidgetUtils.addJitsiWidget(roomId, CallType.Video, "Video channel", true, roomName);
};

// Gets the members connected to a given video room, along with a timestamp
// indicating when this data should be considered stale
const getConnectedMembers = (room: Room, connectedLocalEcho: boolean): [Set<RoomMember>, number] => {
    const members = new Set<RoomMember>();
    const now = Date.now();
    let allExpireAt = Infinity;

    for (const e of room.currentState.getStateEvents(VIDEO_CHANNEL_MEMBER)) {
        const member = room.getMember(e.getStateKey());
        const content = e.getContent<IVideoChannelMemberContent>();
        let devices = Array.isArray(content.devices) ? content.devices : [];
        const expiresAt = typeof content.expires_ts === "number" ? content.expires_ts : -Infinity;

        // Ignore events with a timeout that's way off in the future
        const inTheFuture = (expiresAt - ((STUCK_DEVICE_TIMEOUT_MS * 5) / 4)) > now;
        const expired = expiresAt <= now || inTheFuture;

        // Apply local echo for the disconnected case
        if (!connectedLocalEcho && member?.userId === room.client.getUserId()) {
            devices = devices.filter(d => d !== room.client.getDeviceId());
        }
        // Must have a device connected, be unexpired, and still be joined to the room
        if (devices.length && !expired && member?.membership === "join") {
            members.add(member);
            if (expiresAt < allExpireAt) allExpireAt = expiresAt;
        }
    }

    // Apply local echo for the connected case
    if (connectedLocalEcho) members.add(room.getMember(room.client.getUserId()));
    return [members, allExpireAt];
};

export const useConnectedMembers = (
    room: Room, connectedLocalEcho: boolean, throttleMs = 100,
): Set<RoomMember> => {
    const [[members, expiresAt], setState] = useState(() => getConnectedMembers(room, connectedLocalEcho));
    const updateState = useMemo(() => throttle(() => {
        setState(getConnectedMembers(room, connectedLocalEcho));
    }, throttleMs, { leading: true, trailing: true }), [setState, room, connectedLocalEcho, throttleMs]);

    useTypedEventEmitter(room.currentState, RoomStateEvent.Update, updateState);
    useEffect(() => {
        if (expiresAt < Infinity) {
            const timer = setTimeout(() => {
                logger.log(`Refreshing video members for ${room.roomId}`);
                updateState();
            }, expiresAt - Date.now());
            return () => clearTimeout(timer);
        }
    }, [expiresAt, updateState, room.roomId]);

    return members;
};

export const useJitsiParticipants = (room: Room): IJitsiParticipant[] => {
    const store = VideoChannelStore.instance;
    const [participants, setParticipants] = useState(() =>
        store.connected && store.roomId === room.roomId ? store.participants : [],
    );

    useEventEmitter(store, VideoChannelEvent.Disconnect, (roomId: string) => {
        if (roomId === room.roomId) setParticipants([]);
    });
    useEventEmitter(store, VideoChannelEvent.Participants, (roomId: string, participants: IJitsiParticipant[]) => {
        if (roomId === room.roomId) setParticipants(participants);
    });

    return participants;
};

const updateDevices = async (room: Optional<Room>, fn: (devices: string[] | null) => string[]) => {
    if (room?.getMyMembership() !== "join") return;

    const devicesState = room.currentState.getStateEvents(VIDEO_CHANNEL_MEMBER, room.client.getUserId());
    const devices = devicesState?.getContent<IVideoChannelMemberContent>()?.devices ?? [];
    const newDevices = fn(devices);

    if (newDevices) {
        const content: IVideoChannelMemberContent = {
            devices: newDevices,
            expires_ts: Date.now() + STUCK_DEVICE_TIMEOUT_MS,
        };

        await room.client.sendStateEvent(room.roomId, VIDEO_CHANNEL_MEMBER, content, room.client.getUserId());
    }
};

export const addOurDevice = async (room: Room) => {
    await updateDevices(room, devices => Array.from(new Set(devices).add(room.client.getDeviceId())));
};

export const removeOurDevice = async (room: Room) => {
    await updateDevices(room, devices => {
        const devicesSet = new Set(devices);
        devicesSet.delete(room.client.getDeviceId());
        return Array.from(devicesSet);
    });
};

/**
 * Fixes devices that may have gotten stuck in video channel member state after
 * an unclean disconnection, by filtering out logged out devices, inactive
 * devices, and our own device (if we're disconnected).
 * @param {Room} room The room to fix
 * @param {boolean} connectedLocalEcho Local echo of whether this device is connected
 */
export const fixStuckDevices = async (room: Room, connectedLocalEcho: boolean) => {
    const now = Date.now();
    const { devices: myDevices } = await room.client.getDevices();
    const deviceMap = new Map<string, IMyDevice>(myDevices.map(d => [d.device_id, d]));

    await updateDevices(room, devices => {
        const newDevices = devices.filter(d => {
            const device = deviceMap.get(d);
            return device?.last_seen_ts
                && !(d === room.client.getDeviceId() && !connectedLocalEcho)
                && (now - device.last_seen_ts) < STUCK_DEVICE_TIMEOUT_MS;
        });

        // Skip the update if the devices are unchanged
        return newDevices.length === devices.length ? null : newDevices;
    });
};

export const useConnectionState = (room: Room): ConnectionState => {
    const store = VideoChannelStore.instance;
    const [state, setState] = useState(() =>
        store.roomId === room.roomId
            ? store.connected
                ? ConnectionState.Connected
                : ConnectionState.Connecting
            : ConnectionState.Disconnected,
    );

    useEventEmitter(store, VideoChannelEvent.Disconnect, (roomId: string) => {
        if (roomId === room.roomId) setState(ConnectionState.Disconnected);
    });
    useEventEmitter(store, VideoChannelEvent.StartConnect, (roomId: string) => {
        if (roomId === room.roomId) setState(ConnectionState.Connecting);
    });
    useEventEmitter(store, VideoChannelEvent.Connect, (roomId: string) => {
        if (roomId === room.roomId) setState(ConnectionState.Connected);
    });

    return state;
};
