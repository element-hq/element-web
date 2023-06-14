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

import React, { useEffect, useState } from "react";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";

import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";

interface IProps {
    room: Room;
    children?(name: string): JSX.Element;
}

const RoomName = ({ room, children }: IProps): JSX.Element => {
    const [name, setName] = useState(room?.name);
    useTypedEventEmitter(room, RoomEvent.Name, () => {
        setName(room?.name);
    });
    useEffect(() => {
        setName(room?.name);
    }, [room]);

    if (children) return children(name);
    return <>{name || ""}</>;
};

export default RoomName;
