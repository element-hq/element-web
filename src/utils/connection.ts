/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ClientEvent, type ClientEventHandlerMap, SyncState } from "matrix-js-sdk/src/matrix";

/**
 * Creates a MatrixClient event listener function that can be used to get notified about reconnects.
 * @param callback The callback to be called on reconnect
 */
export const createReconnectedListener = (callback: () => void): ClientEventHandlerMap[ClientEvent.Sync] => {
    return (syncState: SyncState, prevState: SyncState | null) => {
        if (syncState !== SyncState.Error && prevState !== syncState) {
            // Consider the client reconnected if there is no error with syncing.
            // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
            callback();
        }
    };
};
