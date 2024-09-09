/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { createContext, useContext } from "react";

import { IRoomState } from "../components/structures/RoomView";
import { Layout } from "../settings/enums/Layout";

export enum TimelineRenderingType {
    Room = "Room",
    Thread = "Thread",
    ThreadsList = "ThreadsList",
    File = "File",
    Notification = "Notification",
    Search = "Search",
    Pinned = "Pinned",
}

const RoomContext = createContext<
    IRoomState & {
        threadId?: string;
    }
>({
    roomLoading: true,
    peekLoading: false,
    shouldPeek: true,
    membersLoaded: false,
    numUnreadMessages: 0,
    canPeek: false,
    showApps: false,
    isPeeking: false,
    showRightPanel: true,
    threadRightPanel: false,
    joining: false,
    showTopUnreadMessagesBar: false,
    statusBarVisible: false,
    canReact: false,
    canSelfRedact: false,
    canSendMessages: false,
    resizing: false,
    layout: Layout.Group,
    lowBandwidth: false,
    alwaysShowTimestamps: false,
    showTwelveHourTimestamps: false,
    userTimezone: undefined,
    readMarkerInViewThresholdMs: 3000,
    readMarkerOutOfViewThresholdMs: 30000,
    showHiddenEvents: false,
    showReadReceipts: true,
    showRedactions: true,
    showJoinLeaves: true,
    showAvatarChanges: true,
    showDisplaynameChanges: true,
    matrixClientIsReady: false,
    showUrlPreview: false,
    timelineRenderingType: TimelineRenderingType.Room,
    threadId: undefined,
    liveTimeline: undefined,
    narrow: false,
    activeCall: null,
    msc3946ProcessDynamicPredecessor: false,
    canAskToJoin: false,
    promptAskToJoin: false,
    viewRoomOpts: { buttons: [] },
});
RoomContext.displayName = "RoomContext";
export default RoomContext;
export function useRoomContext(): IRoomState {
    return useContext(RoomContext);
}
