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

import { MatrixClient, MatrixEvent, MatrixEventEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { Thread } from "matrix-js-sdk/src/models/thread";

import { mkMessage, MessageEventProps } from "./test-utils";

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
                latest_event: events[events.length - 1],
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

    events.forEach((event) => {
        thread.timeline.push(event);
    });

    // So that we do not have to mock the thread loading
    thread.initialEventsFetched = true;

    return { thread, rootEvent, events };
};
