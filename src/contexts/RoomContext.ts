/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { createContext } from "react";

import { IRoomState } from "../components/structures/RoomView";
import { Layout } from "../settings/Layout";

export enum TimelineRenderingType {
    Room = "Room",
    Thread = "Thread",
    ThreadsList = "ThreadsList",
    File = "File",
    Notification = "Notification",
}

const RoomContext = createContext<IRoomState>({
    roomLoading: true,
    peekLoading: false,
    shouldPeek: true,
    membersLoaded: false,
    numUnreadMessages: 0,
    draggingFile: false,
    searching: false,
    guestsCanJoin: false,
    canPeek: false,
    showApps: false,
    isPeeking: false,
    showRightPanel: true,
    joining: false,
    atEndOfLiveTimeline: true,
    atEndOfLiveTimelineInit: false,
    showTopUnreadMessagesBar: false,
    statusBarVisible: false,
    canReact: false,
    canReply: false,
    layout: Layout.Group,
    lowBandwidth: false,
    alwaysShowTimestamps: false,
    showTwelveHourTimestamps: false,
    readMarkerInViewThresholdMs: 3000,
    readMarkerOutOfViewThresholdMs: 30000,
    showHiddenEventsInTimeline: false,
    showReadReceipts: true,
    showRedactions: true,
    showJoinLeaves: true,
    showAvatarChanges: true,
    showDisplaynameChanges: true,
    matrixClientIsReady: false,
    dragCounter: 0,
    timelineRenderingType: TimelineRenderingType.Room,
    liveTimeline: undefined,
});
RoomContext.displayName = "RoomContext";
export default RoomContext;
