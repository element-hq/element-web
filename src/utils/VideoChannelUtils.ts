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

import { useState } from "react";
import { throttle } from "lodash";
import { Optional } from "matrix-events-sdk";
import { IMyDevice } from "matrix-js-sdk/src/client";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { useTypedEventEmitter } from "../hooks/useEventEmitter";
import WidgetStore, { IApp } from "../stores/WidgetStore";
import { WidgetType } from "../widgets/WidgetType";
import WidgetUtils from "./WidgetUtils";

const STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60;

interface IVideoChannelMemberContent {
    // Connected device IDs
    devices: string[];
}

export const VIDEO_CHANNEL_MEMBER = "io.element.video.member";

export const getVideoChannel = (roomId: string): IApp => {
    const apps = WidgetStore.instance.getApps(roomId);
    return apps.find(app => WidgetType.JITSI.matches(app.type) && app.data.isVideoChannel);
};

export const addVideoChannel = async (roomId: string, roomName: string) => {
    await WidgetUtils.addJitsiWidget(roomId, CallType.Video, "Video channel", true, roomName);
};

export const getConnectedMembers = (room: Room, connectedLocalEcho: boolean): Set<RoomMember> => {
    const members = new Set<RoomMember>();

    for (const e of room.currentState.getStateEvents(VIDEO_CHANNEL_MEMBER)) {
        const member = room.getMember(e.getStateKey());
        let devices = e.getContent<IVideoChannelMemberContent>()?.devices ?? [];

        // Apply local echo for the disconnected case
        if (!connectedLocalEcho && member?.userId === room.client.getUserId()) {
            devices = devices.filter(d => d !== room.client.getDeviceId());
        }
        // Must have a device connected and still be joined to the room
        if (devices.length && member?.membership === "join") members.add(member);
    }

    // Apply local echo for the connected case
    if (connectedLocalEcho) members.add(room.getMember(room.client.getUserId()));
    return members;
};

export const useConnectedMembers = (
    room: Room, connectedLocalEcho: boolean, throttleMs = 100,
): Set<RoomMember> => {
    const [members, setMembers] = useState<Set<RoomMember>>(getConnectedMembers(room, connectedLocalEcho));
    useTypedEventEmitter(room.currentState, RoomStateEvent.Update, throttle(() => {
        setMembers(getConnectedMembers(room, connectedLocalEcho));
    }, throttleMs, { leading: true, trailing: true }));
    return members;
};

const updateDevices = async (room: Optional<Room>, fn: (devices: string[] | null) => string[]) => {
    if (room?.getMyMembership() !== "join") return;

    const devicesState = room.currentState.getStateEvents(VIDEO_CHANNEL_MEMBER, room.client.getUserId());
    const devices = devicesState?.getContent<IVideoChannelMemberContent>()?.devices ?? [];
    const newDevices = fn(devices);

    if (newDevices) {
        await room.client.sendStateEvent(
            room.roomId, VIDEO_CHANNEL_MEMBER, { devices: newDevices }, room.client.getUserId(),
        );
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
    const now = new Date().valueOf();
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
