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

import { useEffect, useState } from "react";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { parseTopicContent, TopicState } from "matrix-js-sdk/src/content-helpers";
import { MRoomTopicEventContent } from "matrix-js-sdk/src/@types/topic";
import { Optional } from "matrix-events-sdk";

import { useTypedEventEmitter } from "../useEventEmitter";

export const getTopic = (room: Room): Optional<TopicState> => {
    const content = room?.currentState?.getStateEvents(EventType.RoomTopic, "")?.getContent<MRoomTopicEventContent>();
    return !!content ? parseTopicContent(content) : null;
};

export function useTopic(room: Room): Optional<TopicState> {
    const [topic, setTopic] = useState(getTopic(room));
    useTypedEventEmitter(room.currentState, RoomStateEvent.Events, (ev: MatrixEvent) => {
        if (ev.getType() !== EventType.RoomTopic) return;
        setTopic(getTopic(room));
    });
    useEffect(() => {
        setTopic(getTopic(room));
    }, [room]);

    return topic;
}
