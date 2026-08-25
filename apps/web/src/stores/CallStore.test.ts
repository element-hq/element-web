/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { type CallMembership, MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc";
import { type Room } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    enableCalls,
} from "test-utils";

import { ElementCall } from "../models/Call";
import { CallStore } from "./CallStore";
import SdkConfig from "../SdkConfig";

describe("CallStore", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;

    beforeEach(() => {
        enableCalls();
        const res = setUpClientRoomAndStores();
        client = res.client;
        room = res.room;
    });

    afterEach(() => {
        cleanUpClientRoomAndStores(client, room);
        vi.restoreAllMocks();
    });

    it("constructs one call for one MatrixRTC session", () => {
        setupAsyncStoreWithClient(CallStore.instance, client);
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
        client.cachedRtcTransports.get.mockReturnValue([{ type: "type-a", some_data: "value" }]);
        client.getClientWellKnown.mockReturnValue({
            "org.matrix.msc4143.rtc_foci": [{ type: "type-c", other_data: "bar" }],
        });
        await setupAsyncStoreWithClient(CallStore.instance, client);
        // Only the modern endpoint contributes; the legacy well-known fallback is skipped entirely.
        expect(CallStore.instance.getConfiguredRTCTransports()).toEqual([{ type: "type-a", some_data: "value" }]);
        expect(client.waitForClientWellKnown).not.toHaveBeenCalled();
        expect(client.getClientWellKnown).not.toHaveBeenCalled();
    });
});
