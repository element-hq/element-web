/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";

interface IProps {
    room?: Room;
    children?(name: string): JSX.Element;
}

/**
 * @deprecated use `useRoomName.ts` instead
 */
const RoomName = ({ room, children }: IProps): JSX.Element => {
    const [name, setName] = useState(room?.name);
    useTypedEventEmitter(room, RoomEvent.Name, () => {
        setName(room?.name);
    });
    useEffect(() => {
        setName(room?.name);
    }, [room]);

    if (children) return children(name ?? "");
    return <>{name || ""}</>;
};

export default RoomName;
