/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useState } from "react";
import { MatrixClient, MatrixEvent, Room, RoomStateEvent, EventType } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "./useEventEmitter";

// Hook to simplify watching whether a Matrix room is encrypted, returns undefined if room is undefined or when isRoomEncrypted is computed
export function useIsEncrypted(cli: MatrixClient, room?: Room): boolean | undefined {
    const [isEncrypted, setIsEncrypted] = useState<boolean>();

    useEffect(() => {
        const func = async (): Promise<void> =>
            room && setIsEncrypted(await cli.getCrypto()?.isEncryptionEnabledInRoom(room.roomId));
        func();
    }, [cli, room]);
    const update = useCallback(
        async (event: MatrixEvent) => {
            if (room && event.getType() === EventType.RoomEncryption) {
                setIsEncrypted(await cli.getCrypto()?.isEncryptionEnabledInRoom(room.roomId));
            }
        },
        [cli, room],
    );
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, update);

    return isEncrypted;
}
