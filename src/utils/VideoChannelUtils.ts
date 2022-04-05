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

import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { RoomState } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

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

export const getConnectedMembers = (state: RoomState): RoomMember[] =>
    state.getStateEvents(VIDEO_CHANNEL_MEMBER)
        // Must have a device connected and still be joined to the room
        .filter(e => e.getContent<IVideoChannelMemberContent>().devices?.length)
        .map(e => state.getMember(e.getStateKey()))
        .filter(member => member.membership === "join");
