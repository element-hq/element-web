/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent, type Room, EventType } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import { useRoomState } from "./useRoomState.ts";
import { useAsyncMemo } from "./useAsyncMemo.ts";
import { LocalRoom } from "../models/LocalRoom.ts";

/**
 * Check if a room is encrypted.
 * If the room is a LocalRoom, check the state directly.
 * Otherwise, use the crypto API to check if encryption is enabled in the room.
 *
 * @param room - The room to check.
 * @param cryptoApi - The crypto API from the Matrix client.
 */
export async function isRoomEncrypted(room: Room, cryptoApi: CryptoApi): Promise<boolean> {
    if (room instanceof LocalRoom) {
        // For local room check the state.
        // The crypto check fails because the room ID is not valid (it is a local id)
        return (room as LocalRoom).isEncryptionEnabled();
    }

    return await cryptoApi.isEncryptionEnabledInRoom(room.roomId);
}

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

            return isRoomEncrypted(room, crypto);
        },
        [room, encryptionStateEvent],
        null,
    );
}
