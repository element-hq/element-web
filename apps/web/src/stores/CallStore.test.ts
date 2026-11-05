/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { type CallMembership, MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc";
import { type Room } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    enableCalls,
    flushPromises,
    resetAsyncStoreWithClient,
} from "test-utils";

import { ElementCall } from "../models/Call";
import { CallStore } from "./CallStore";
import SdkConfig from "../SdkConfig";
import WidgetStore from "./WidgetStore";
import { UPDATE_EVENT } from "./AsyncStore";

describe("CallStore", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;
    let roomSession: ReturnType<typeof setUpClientRoomAndStores>["roomSession"];

    beforeAll(() => {
        // Create the store while there is no client. Otherwise the getter also sets it up with the first test's
        // client, and as the reset after each test only removes one set of listeners, some would be left behind.
        void CallStore.instance;
    });

    beforeEach(() => {
        enableCalls();
        const res = setUpClientRoomAndStores();
        client = res.client;
        room = res.room;
        roomSession = res.roomSession;
    });

    afterEach(async () => {
        await resetAsyncStoreWithClient(CallStore.instance);
        cleanUpClientRoomAndStores(client, room);
        vi.restoreAllMocks();
    });

    it("constructs one call for one MatrixRTC session", async () => {
        await setupAsyncStoreWithClient(CallStore.instance, client);
        const getSpy = vi.spyOn(ElementCall, "get");

        // Simulate another user starting a new MatrixRTC session
        const session = client.matrixRTC.getRoomSession(room);
        session.memberships.push({} as CallMembership);
        client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, room.roomId, session);

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveReturnedWith(expect.any(ElementCall));
        expect(CallStore.instance.getCall(room.roomId)).not.toBe(null);
        expect(CallStore.instance.getConfiguredRTCTransports()).toHaveLength(0);
    });

    describe("while the session's memberships are still being calculated", () => {
        let membershipsCalculated: PromiseWithResolvers<void>;

        beforeEach(() => {
            membershipsCalculated = Promise.withResolvers<void>();
            Object.assign(roomSession, { initialMembershipCalculated: membershipsCalculated.promise });
        });

        it("constructs a call once the memberships have been calculated", async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);
            expect(CallStore.instance.getCall(room.roomId)).toBe(null);

            roomSession.memberships.push({} as CallMembership);
            membershipsCalculated.resolve();
            await flushPromises();

            expect(CallStore.instance.getCall(room.roomId)).toEqual(expect.any(ElementCall));
        });

        it("constructs a call for a room that arrives after the store has started", async () => {
            // As on reload, where the store starts before the rooms are loaded from the sync cache
            client.getRooms.mockReturnValue([]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
            client.getRooms.mockReturnValue([room]);
            WidgetStore.instance.emit(UPDATE_EVENT, room.roomId);
            expect(CallStore.instance.getCall(room.roomId)).toBe(null);

            roomSession.memberships.push({} as CallMembership);
            membershipsCalculated.resolve();
            await flushPromises();

            expect(CallStore.instance.getCall(room.roomId)).toEqual(expect.any(ElementCall));
        });

        it("does not check the room again if the calculation finds no members", async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const getSpy = vi.spyOn(ElementCall, "get");

            membershipsCalculated.resolve();
            await flushPromises();

            expect(getSpy).not.toHaveBeenCalled();
            expect(CallStore.instance.getCall(room.roomId)).toBe(null);
        });

        it("handles the calculation failing", async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);

            membershipsCalculated.reject(new Error("calculation failed"));
            await flushPromises();

            expect(CallStore.instance.getCall(room.roomId)).toBe(null);
        });

        it("does not construct a call if the store stops before the calculation finishes", async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);
            await resetAsyncStoreWithClient(CallStore.instance);

            roomSession.memberships.push({} as CallMembership);
            membershipsCalculated.resolve();
            await flushPromises();

            expect(CallStore.instance.getCall(room.roomId)).toBe(null);
        });
    });

    it("delegates transport discovery to the client", async () => {
        client.cachedRtcTransports.get.mockReturnValue([
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
        ]);
    });

    it("does not fall back to client well-known when enable_client_well_known_lookups is false", async () => {
        const sdkConfigGet = SdkConfig.get;
        vi.spyOn(SdkConfig, "get").mockImplementation((key?: any, altCaseName?: string): any => {
            if (key === "enable_client_well_known_lookups") return false;
            return sdkConfigGet(key, altCaseName);
        });
        client.cachedRtcTransports.wait.mockRejectedValue(new Error("transports unavailable"));
        client.cachedRtcTransports.get.mockReturnValue([{ type: "type-a", some_data: "value" }]);
        client.getClientWellKnown.mockReturnValue({
            "org.matrix.msc4143.rtc_foci": [{ type: "type-c", other_data: "bar" }],
        });
        await setupAsyncStoreWithClient(CallStore.instance, client);
        await flushPromises();
        // Only the modern endpoint contributes; the legacy well-known fallback is skipped entirely.
        expect(CallStore.instance.getConfiguredRTCTransports()).toEqual([{ type: "type-a", some_data: "value" }]);
        expect(client.waitForClientWellKnown).not.toHaveBeenCalled();
        expect(client.getClientWellKnown).not.toHaveBeenCalled();
    });

    it("falls back to client well-known when fetching transports fails, ignoring well-known errors", async () => {
        client.cachedRtcTransports.wait.mockRejectedValue(new Error("transports unavailable"));
        client.waitForClientWellKnown.mockRejectedValue(new Error("well-known unavailable"));
        await setupAsyncStoreWithClient(CallStore.instance, client);
        // The lookup is not awaited by onReady, so let it settle. An unhandled rejection would fail the test.
        await flushPromises();
        expect(client.waitForClientWellKnown).toHaveBeenCalled();
    });
});
