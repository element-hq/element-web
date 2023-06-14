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

import { createReconnectedListener } from "../../src/utils/connection";

describe("createReconnectedListener", () => {
    let reconnectedListener: ClientEventHandlerMap[ClientEvent.Sync];
    let onReconnect: jest.Mock;

    beforeEach(() => {
        onReconnect = jest.fn();
        reconnectedListener = createReconnectedListener(onReconnect);
    });

    [
        [SyncState.Prepared, SyncState.Syncing],
        [SyncState.Syncing, SyncState.Reconnecting],
        [SyncState.Reconnecting, SyncState.Syncing],
    ].forEach(([from, to]) => {
        it(`should invoke the callback on a transition from ${from} to ${to}`, () => {
            reconnectedListener(to, from);
            expect(onReconnect).toHaveBeenCalled();
        });
    });

    [
        [SyncState.Syncing, SyncState.Syncing],
        [SyncState.Catchup, SyncState.Error],
        [SyncState.Reconnecting, SyncState.Error],
    ].forEach(([from, to]) => {
        it(`should not invoke the callback on a transition from ${from} to ${to}`, () => {
            reconnectedListener(to, from);
            expect(onReconnect).not.toHaveBeenCalled();
        });
    });
});
