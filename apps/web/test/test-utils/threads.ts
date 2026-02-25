/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    RelationType,
    type Room,
    type Thread,
} from "matrix-js-sdk/src/matrix";

import { mkMessage, type MessageEventProps } from "./test-utils";

export const makeThreadEvent = ({
    rootEventId,
    replyToEventId,
    ...props
}: MessageEventProps & {
    rootEventId: string;
    replyToEventId: string;
}): MatrixEvent =>
    mkMessage({
        ...props,
        relatesTo: {
            event_id: rootEventId,
            rel_type: "m.thread",
            ["m.in_reply_to"]: {
                event_id: replyToEventId,
            },
        },
    });

type MakeThreadEventsProps = {
    roomId: Room["roomId"];
    // root message user id
    authorId: string;
    // user ids of thread replies
    // cycled through until thread length is fulfilled
    participantUserIds: string[];
    // number of messages in the thread, root message included
    // optional, default 2
    length?: number;
    ts?: number;
    // provide to set current_user_participated accurately
    currentUserId?: string;
};

export const makeThreadEvents = ({
    roomId,
    authorId,
    participantUserIds,
    length = 2,
    ts = 1,
    currentUserId,
}: MakeThreadEventsProps): { rootEvent: MatrixEvent; events: MatrixEvent[] } => {
    const rootEvent = mkMessage({
        user: authorId,
        event: true,
        room: roomId,
        msg: "root event message " + Math.random(),
        ts,
    });

    const rootEventId = rootEvent.getId()!;
    const events = [rootEvent];

    for (let i = 1; i < length; i++) {
        const prevEvent = events[i - 1];
        const replyToEventId = prevEvent.getId()!;
        const user = participantUserIds[i % participantUserIds.length];
        events.push(
            makeThreadEvent({
                user,
                room: roomId,
                event: true,
                msg: `reply ${i} by ${user}`,
                rootEventId,
                replyToEventId,
                // replies are 1ms after each other
                ts: ts + i,
            }),
        );
    }

    rootEvent.setUnsigned({
        "m.relations": {
            [RelationType.Thread]: {
                latest_event: events[events.length - 1].event,
                count: length,
                current_user_participated: [...participantUserIds, authorId].includes(currentUserId!),
            },
        },
    });

    return { rootEvent, events };
};

type MakeThreadProps = {
    room: Room;
    client: MatrixClient;
    authorId: string;
    participantUserIds: string[];
    length?: number;
    ts?: number;
};

/**
 * Create a thread but don't actually populate it with events - see
 * populateThread for what you probably want to do.
 *
 * Leaving this here in case it is needed by some people, but I (andyb) would
 * expect us to move to use populateThread exclusively.
 */
export const mkThread = ({
    room,
    client,
    authorId,
    participantUserIds,
    length = 2,
    ts = 1,
}: MakeThreadProps): { thread: Thread; rootEvent: MatrixEvent; events: MatrixEvent[] } => {
    const { rootEvent, events } = makeThreadEvents({
        roomId: room.roomId,
        authorId,
        participantUserIds,
        length,
        ts,
        currentUserId: client.getUserId()!,
    });
    expect(rootEvent).toBeTruthy();

    for (const evt of events) {
        room?.reEmitter.reEmit(evt, [MatrixEventEvent.BeforeRedaction]);
    }

    const thread = room.createThread(rootEvent.getId()!, rootEvent, events, true);

    return { thread, rootEvent, events };
};

/**
 * Create a thread, and make sure the events added to the thread and the room's
 * timeline as if they came in via sync.
 *
 * Note that mkThread doesn't actually add the events properly to the room.
 */
export const populateThread = async ({
    room,
    client,
    authorId,
    participantUserIds,
    length = 2,
    ts = 1,
}: MakeThreadProps): Promise<{ thread: Thread; rootEvent: MatrixEvent; events: MatrixEvent[] }> => {
    const ret = mkThread({ room, client, authorId, participantUserIds, length, ts });

    // So that we do not have to mock the thread loading, tell the thread
    // that it is already loaded, and send the events again to the room
    // so they are added to the thread timeline.
    ret.thread.initialEventsFetched = true;
    await room.addLiveEvents(ret.events, { addToState: false });
    return ret;
};
