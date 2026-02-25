/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ClientEvent, type ClientEventHandlerMap, SyncState } from "matrix-js-sdk/src/matrix";

import { createReconnectedListener } from "../../../src/utils/connection";

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
