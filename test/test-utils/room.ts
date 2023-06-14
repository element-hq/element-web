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

import { MockedObject } from "jest-mock";
import { MatrixClient, MatrixEvent, EventType, Room, EventTimeline } from "matrix-js-sdk/src/matrix";

import { IRoomState } from "../../src/components/structures/RoomView";
import { TimelineRenderingType } from "../../src/contexts/RoomContext";
import { Layout } from "../../src/settings/enums/Layout";
import { mkEvent } from "./test-utils";

export const makeMembershipEvent = (roomId: string, userId: string, membership = "join") =>
    mkEvent({
        event: true,
        type: EventType.RoomMember,
        room: roomId,
        user: userId,
        skey: userId,
        content: { membership },
        ts: Date.now(),
    });

/**
 * Creates a room
 * sets state events on the room
 * Sets client getRoom to return room
 * returns room
 */
export const makeRoomWithStateEvents = (
    stateEvents: MatrixEvent[] = [],
    { roomId, mockClient }: { roomId: string; mockClient: MockedObject<MatrixClient> },
): Room => {
    const room1 = new Room(roomId, mockClient, "@user:server.org");
    room1.currentState.setStateEvents(stateEvents);
    mockClient.getRoom.mockReturnValue(room1);
    return room1;
};

export function getRoomContext(room: Room, override: Partial<IRoomState>): IRoomState {
    return {
        room,
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canSendMessages: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEvents: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
        canSelfRedact: false,
        resizing: false,
        narrow: false,
        activeCall: null,
        msc3946ProcessDynamicPredecessor: false,

        ...override,
    };
}

export const setupRoomWithEventsTimeline = (room: Room, events: MatrixEvent[] = []): void => {
    const timelineSet = room.getUnfilteredTimelineSet();
    const getTimelineForEventSpy = jest.spyOn(timelineSet, "getTimelineForEvent");
    const eventTimeline = {
        getEvents: jest.fn().mockReturnValue(events),
    } as unknown as EventTimeline;
    getTimelineForEventSpy.mockReturnValue(eventTimeline);
};
