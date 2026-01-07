/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type CallMembership, MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc";

import { ElementCall } from "../../../src/models/Call";
import { CallStore } from "../../../src/stores/CallStore";
import {
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    enableCalls,
} from "../../test-utils";

enableCalls();

test("CallStore constructs one call for one MatrixRTC session", () => {
    const { client, room } = setUpClientRoomAndStores();
    try {
        setupAsyncStoreWithClient(CallStore.instance, client);
        const getSpy = jest.spyOn(ElementCall, "get");

        // Simulate another user starting a new MatrixRTC session
        const session = client.matrixRTC.getRoomSession(room);
        session.memberships.push({} as CallMembership);
        client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, room.roomId, session);

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveReturnedWith(expect.any(ElementCall));
        expect(CallStore.instance.getCall(room.roomId)).not.toBe(null);
    } finally {
        cleanUpClientRoomAndStores(client, room);
    }
});
