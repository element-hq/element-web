/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MockedObject } from "jest-mock";
import { type EventTimeline, EventType, type MatrixClient, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { type IRoomState, MainSplitContentType } from "../../src/components/structures/RoomView";
import { TimelineRenderingType } from "../../src/contexts/RoomContext";
import { Layout } from "../../src/settings/enums/Layout";
import { mkEvent } from "./test-utils";

export const makeMembershipEvent = (roomId: string, userId: string, membership = KnownMembership.Join) =>
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
        userTimezone: undefined,
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
        mainSplitContentType: MainSplitContentType.Timeline,
        liveTimeline: undefined,
        canSelfRedact: false,
        resizing: false,
        narrow: false,
        msc3946ProcessDynamicPredecessor: false,
        canAskToJoin: false,
        promptAskToJoin: false,
        viewRoomOpts: { buttons: [] },
        isRoomEncrypted: false,
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
