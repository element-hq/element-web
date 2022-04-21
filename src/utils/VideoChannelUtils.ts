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
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { useTypedEventEmitter } from "../hooks/useEventEmitter";
import WidgetStore, { IApp } from "../stores/WidgetStore";
import { WidgetType } from "../widgets/WidgetType";
import WidgetUtils from "./WidgetUtils";

export const VIDEO_CHANNEL = "io.element.video";
export const VIDEO_CHANNEL_MEMBER = "io.element.video.member";

export interface IVideoChannelMemberContent {
    // Connected device IDs
    devices: string[];
}

export const getVideoChannel = (roomId: string): IApp => {
    const apps = WidgetStore.instance.getApps(roomId);
    return apps.find(app => WidgetType.JITSI.matches(app.type) && app.id === VIDEO_CHANNEL);
};

export const addVideoChannel = async (roomId: string, roomName: string) => {
    await WidgetUtils.addJitsiWidget(roomId, CallType.Video, "Video channel", VIDEO_CHANNEL, roomName);
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
