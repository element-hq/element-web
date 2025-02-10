/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent, type Room, EventType } from "matrix-js-sdk/src/matrix";

import { useRoomState } from "./useRoomState.ts";
import { useAsyncMemo } from "./useAsyncMemo.ts";

// Hook to simplify watching whether a Matrix room is encrypted, returns null if room is undefined or the state is loading
export function useIsEncrypted(cli: MatrixClient, room?: Room): boolean | null {
    const encryptionStateEvent: MatrixEvent | undefined = useRoomState(
        room,
        (roomState) => roomState.getStateEvents(EventType.RoomEncryption)?.[0],
    );
    return useAsyncMemo(
        async () => {
            const crypto = cli.getCrypto();
            if (!room || !crypto) return null;

            return crypto.isEncryptionEnabledInRoom(room.roomId);
        },
        [room, encryptionStateEvent],
        null,
    );
}
