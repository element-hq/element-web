/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type CallMembership, MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type MockedObject } from "jest-mock";

import { CallEvent, ElementCall } from "../../../src/models/Call";
import { CallStore, CallStoreEvent } from "../../../src/stores/CallStore";
import {
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    enableCalls,
} from "../../test-utils";

describe("CallStore", () => {
    let client: MockedObject<MatrixClient>;
    let room: Room;
    beforeEach(() => {
        enableCalls();
        const res = setUpClientRoomAndStores();
        client = res.client;
        room = res.room;
    });

    afterEach(() => {
        cleanUpClientRoomAndStores(client, room);
        jest.restoreAllMocks();
    });

    it("constructs one call for one MatrixRTC session", () => {
        setupAsyncStoreWithClient(CallStore.instance, client);
        const getSpy = jest.spyOn(ElementCall, "get");

        // Simulate another user starting a new MatrixRTC session
        const session = client.matrixRTC.getRoomSession(room);
        session.memberships.push({} as CallMembership);
        client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, room.roomId, session);

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveReturnedWith(expect.any(ElementCall));
        expect(CallStore.instance.getCall(room.roomId)).not.toBe(null);
        expect(CallStore.instance.getConfiguredRTCTransports()).toHaveLength(0);
    });
    it("calculates RTC transports with both modern and legacy endpoints", async () => {
        client._unstable_getRTCTransports.mockResolvedValue([
            { type: "type-a", some_data: "value" },
            { type: "type-b", some_data: "foo" },
        ]);
        client.getClientWellKnown.mockReturnValue({
            "org.matrix.msc4143.rtc_foci": [
                { type: "type-c", other_data: "bar" },
                { type: "type-d", other_data: "baz" },
            ],
        });
        await setupAsyncStoreWithClient(CallStore.instance, client);
        expect(CallStore.instance.getConfiguredRTCTransports()).toEqual([
            { type: "type-a", some_data: "value" },
            { type: "type-b", some_data: "foo" },
            { type: "type-c", other_data: "bar" },
            { type: "type-d", other_data: "baz" },
        ]);
    });

    it("emits CallStoreEvent.Participants when a call's participants change", () => {
        setupAsyncStoreWithClient(CallStore.instance, client);

        // Simulate another user starting a new MatrixRTC session
        const session = client.matrixRTC.getRoomSession(room);
        session.memberships.push({} as CallMembership);
        client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, room.roomId, session);

        const call = CallStore.instance.getCall(room.roomId)!;
        expect(call).not.toBeNull();

        const participantsSpy = jest.fn();
        CallStore.instance.on(CallStoreEvent.Participants, participantsSpy);

        // Emit a participants change on the call
        call.emit(CallEvent.Participants, new Map(), new Map());

        expect(participantsSpy).toHaveBeenCalledWith(room.roomId);

        CallStore.instance.off(CallStoreEvent.Participants, participantsSpy);
    });
});
