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

import { ClientEvent, ClientEventHandlerMap } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";

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
