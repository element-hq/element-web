/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type CallMembership, MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { type MockedObject } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";

import { ConnectionState, ElementCall } from "../../../src/models/Call";
import { CallStore } from "../../../src/stores/CallStore";
import {
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    enableCalls,
    useMockedCalls,
    MockedCall,
    flushPromises,
} from "../../test-utils";

describe("CallStore", () => {
    let client: MockedObject<MatrixClient>;
    let room: Room;
    let enabledSettings: Set<string>;
    beforeEach(() => {
        ({ enabledSettings } = enableCalls());
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

    describe("m.call profile field (on-a-call status)", () => {
        let call: MockedCall;
        let call2: MockedCall;

        beforeEach(async () => {
            useMockedCalls();
            // Reset the singleton so calls from previous tests don't linger in the map
            // (setupAsyncStoreWithClient only runs onReady, never onNotReady).
            // @ts-ignore protected access
            await CallStore.instance.onNotReady();
            await setupAsyncStoreWithClient(CallStore.instance, client);
            MockedCall.create(room, "1");
            call = CallStore.instance.getCall(room.roomId) as MockedCall;
        });

        const createSecondCall = (): void => {
            const room2 = new Room("!2:example.org", client, "@alice:example.org");
            client.getRoom.mockImplementation((roomId) => {
                if (roomId === room.roomId) return room;
                if (roomId === room2.roomId) return room2;
                return null;
            });
            MockedCall.create(room2, "2");
            call2 = CallStore.instance.getCall(room2.roomId) as MockedCall;
        };

        describe("when feature_user_status is enabled", () => {
            beforeEach(() => {
                enabledSettings.add("feature_user_status");
            });

            it("sets m.call when the user joins their first call", () => {
                call.setConnectionState(ConnectionState.Connected);

                expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call", {
                    call_joined_ts: expect.any(Number),
                });
            });

            it("clears m.call when the user leaves their last call", () => {
                call.setConnectionState(ConnectionState.Connected);
                client.setExtendedProfileProperty.mockClear();

                call.setConnectionState(ConnectionState.Disconnected);

                expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call", null);
            });

            it("does not re-write m.call when joining a second concurrent call", () => {
                call.setConnectionState(ConnectionState.Connected);
                client.setExtendedProfileProperty.mockClear();

                createSecondCall();
                call2.setConnectionState(ConnectionState.Connected);

                expect(client.setExtendedProfileProperty).not.toHaveBeenCalled();
            });

            it("does not clear m.call while still connected to another call", () => {
                call.setConnectionState(ConnectionState.Connected);
                createSecondCall();
                call2.setConnectionState(ConnectionState.Connected);
                client.setExtendedProfileProperty.mockClear();

                call.setConnectionState(ConnectionState.Disconnected);

                expect(client.setExtendedProfileProperty).not.toHaveBeenCalled();
            });

            it("swallows failures to update the profile field", async () => {
                const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
                client.setExtendedProfileProperty.mockRejectedValue(new Error("Server does not support extended profiles"));

                expect(() => call.setConnectionState(ConnectionState.Connected)).not.toThrow();
                await flushPromises();

                expect(warnSpy).toHaveBeenCalledWith("Failed to update m.call profile field", expect.any(Error));
            });
        });

        describe("when feature_user_status is disabled", () => {
            it("never touches the m.call profile field", () => {
                call.setConnectionState(ConnectionState.Connected);
                call.setConnectionState(ConnectionState.Disconnected);

                expect(client.setExtendedProfileProperty).not.toHaveBeenCalled();
            });
        });
    });
});
