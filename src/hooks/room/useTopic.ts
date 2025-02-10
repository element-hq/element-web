/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import {
    EventType,
    type MatrixEvent,
    type Room,
    RoomStateEvent,
    ContentHelpers,
    type MRoomTopicEventContent,
} from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { useTypedEventEmitter } from "../useEventEmitter";

export const getTopic = (room?: Room): Optional<ContentHelpers.TopicState> => {
    const content = room?.currentState?.getStateEvents(EventType.RoomTopic, "")?.getContent<MRoomTopicEventContent>();
    return !!content ? ContentHelpers.parseTopicContent(content) : null;
};

/**
 * Helper to retrieve the room topic for given room
 * @param room
 * @returns the raw text and an html parsion version of the room topic
 */
export function useTopic(room?: Room): Optional<ContentHelpers.TopicState> {
    const [topic, setTopic] = useState(getTopic(room));
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, (ev: MatrixEvent) => {
        if (ev.getType() !== EventType.RoomTopic) return;
        setTopic(getTopic(room));
    });
    useEffect(() => {
        setTopic(getTopic(room));
    }, [room]);

    return topic;
}
