/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {useEffect, useState} from "react";
import {EventType} from "matrix-js-sdk/src/@types/event";
import {Room} from "matrix-js-sdk/src/models/room";

import {useEventEmitter} from "../../../hooks/useEventEmitter";
import {linkifyElement} from "../../../HtmlUtils";

interface IProps {
    room?: Room;
    children?(topic: string, ref: (element: HTMLElement) => void): JSX.Element;
}

export const getTopic = room => room?.currentState?.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic;

const RoomTopic = ({ room, children }: IProps): JSX.Element => {
    const [topic, setTopic] = useState(getTopic(room));
    useEventEmitter(room.currentState, "RoomState.events", () => {
        setTopic(getTopic(room));
    });
    useEffect(() => {
        setTopic(getTopic(room));
    }, [room]);

    const ref = e => e && linkifyElement(e);
    if (children) return children(topic, ref);
    return <span ref={ref}>{ topic }</span>;
};

export default RoomTopic;
