/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import {
    getMockClientWithEventEmitter,
    mkRoom,
    mockClientMethodsRooms,
    mockClientMethodsServer,
    mockClientMethodsUser,
    MockEventEmitter,
    setupAsyncStoreWithClient,
    withContexts,
} from "test-utils";

import { PlatformCallType, useRoomCall } from "./room/useRoomCall";
import RoomContext, { type RoomContextType } from "../contexts/RoomContext";
import type LegacyCallHandler from "../LegacyCallHandler";
import { CallStore } from "../stores/CallStore";
import { SDKContextClass } from "../contexts/SDKContextClass";

describe("useRoomCall", () => {
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        ...mockClientMethodsServer(),
        ...mockClientMethodsRooms(),
        matrixRTC: new MockEventEmitter(),
        _unstable_getRTCTransports: vi.fn().mockResolvedValue([]),
        getCrypto: () => null,
    });
    const room = mkRoom(client, "!test-room");
    // Create a stable room context for this test
    const mockRoomViewStore = {
        isViewingCall: vi.fn().mockReturnValue(false),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
    };

    const roomContext = {
        ...RoomContext,
        roomId: room.roomId,
        roomViewStore: mockRoomViewStore,
    } as unknown as RoomContextType;

    beforeEach(() => {
        const callHandler = {
            getCallForRoom: vi.fn().mockReturnValue(null),
            isCallSidebarShown: vi.fn().mockReturnValue(true),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        };
        vi.spyOn(SDKContextClass.instance, "legacyCallHandler", "get").mockReturnValue(
            callHandler as unknown as LegacyCallHandler,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function render() {
        return renderHook(
            () => useRoomCall(room),
            withContexts({ matrixClient: client, roomContext, sdkContext: SDKContextClass.instance }),
        );
    }

    describe("Element Call focus detection", () => {
        it("Blocks Element Call if required foci are not configured", async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it("Blocks Element Call if transport foci are the wrong type", async () => {
            client._unstable_getRTCTransports.mockResolvedValue([{ type: "anything-else" }]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it("Blocks Element Call if well-known foci are the wrong type", async () => {
            client.getClientWellKnown.mockReturnValue({
                "org.matrix.msc4143.rtc_foci": {
                    type: "anything-else",
                },
            });
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it("Allows Element Call if foci is provided via getRTCTransports", async () => {
            client._unstable_getRTCTransports.mockResolvedValue([
                { type: "livekit", livekit_service_url: "https://example.org" },
            ]);
            await setupAsyncStoreWithClient(CallStore.instance, client);

            const { result } = render();
            await waitFor(() =>
                expect(result.current.callOptions).toEqual([PlatformCallType.ElementCall, PlatformCallType.LegacyCall]),
            );
        });
        it("Allows Element Call if foci is provided via .well-known", async () => {
            client.getClientWellKnown.mockReturnValue({
                "org.matrix.msc4143.rtc_foci": {
                    type: "livekit",
                    livekit_service_url: "https://example.org",
                },
            });
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() =>
                expect(result.current.callOptions).toEqual([PlatformCallType.ElementCall, PlatformCallType.LegacyCall]),
            );
        });
        it("Ensure handler reacts to transport changes", async () => {
            // Clear all transports
            client._unstable_getRTCTransports.mockResolvedValue([]);
            client.getClientWellKnown.mockReturnValue({});

            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();

            // Ensure Element Call is not a call option.
            expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]);

            // Now enable a transport and ensure that useRoomCall picks it up reactively.
            client._unstable_getRTCTransports.mockResolvedValue([
                { type: "livekit", livekit_service_url: "https://example.org" },
            ]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
            await waitFor(() =>
                expect(result.current.callOptions).toEqual([PlatformCallType.ElementCall, PlatformCallType.LegacyCall]),
            );
        });
    });
});
