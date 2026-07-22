/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import {
    createStubMatrixRTC,
    getMockClientWithEventEmitter,
    mkRoom,
    mockClientMethodsRooms,
    mockClientMethodsServer,
    mockClientMethodsUser,
    setupAsyncStoreWithClient,
    withContexts,
} from "test-utils";
import { EventType } from "matrix-js-sdk/src/matrix";

import { PlatformCallType, useRoomCall } from "./room/useRoomCall";
import RoomContext, { type RoomContextType } from "../contexts/RoomContext";
import type LegacyCallHandler from "../LegacyCallHandler";
import { CallStore } from "../stores/CallStore";
import { SDKContextClass } from "../contexts/SDKContextClass";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import Modal from "../Modal";
import { placeCall } from "../utils/room/placeCall";
import { RTC_SLOT_ENCRYPTION_PER_MEMBER } from "matrix-js-sdk/src/matrixrtc";

vi.mock("../utils/room/placeCall", () => ({ placeCall: vi.fn() }));

describe("useRoomCall", () => {
    const matrixRTC = createStubMatrixRTC();
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        ...mockClientMethodsServer(),
        ...mockClientMethodsRooms(),
        matrixRTC,
        sendStateEvent: vi.fn().mockResolvedValue({ event_id: "$event" }),
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
        vi.mocked(client.sendStateEvent).mockClear();
        vi.mocked(placeCall).mockClear();
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

    describe("Slot handling", () => {
        beforeEach(async () => {
            SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, true);
            client._unstable_getRTCTransports.mockResolvedValue([
                { type: "livekit", livekit_service_url: "https://example.org" },
            ]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
        });

        afterEach(() => {
            SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, false);
        });

        it("does not disable call buttons when slot is open", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(false);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));
            expect(result.current.voiceCallDisabledReason).toBeNull();
            expect(result.current.videoCallDisabledReason).toBeNull();
        });

        it("disables call buttons when slot is closed, user cannot open it, and there is no other way to call", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(false);
            vi.mocked(room.getJoinedMemberCount).mockReturnValue(3);
            const { result } = render();
            await waitFor(() => expect(result.current.voiceCallDisabledReason).not.toBeNull());
            expect(result.current.callOptions).toEqual([]);
            expect(result.current.voiceCallDisabledReason).toEqual("You do not have permission to start voice calls");
            expect(result.current.videoCallDisabledReason).toEqual("You do not have permission to start video calls");
        });

        it("does not disable call buttons when slot is closed but a non-Element-Call option is still available", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockImplementation(
                (eventType) => eventType !== EventType.RTCSlot,
            );
            vi.mocked(room.getJoinedMemberCount).mockReturnValue(1);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
            expect(result.current.voiceCallDisabledReason).toBeNull();
            expect(result.current.videoCallDisabledReason).toBeNull();
        });

        it("does not disable call buttons when slot is closed but user can open it", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));
            expect(result.current.voiceCallDisabledReason).toBeNull();
            expect(result.current.videoCallDisabledReason).toBeNull();
        });

        it("ignores slot state entirely when labs feature is disabled", async () => {
            SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, false);
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockImplementation(
                (eventType) => eventType !== EventType.RTCSlot,
            );
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));
            expect(result.current.voiceCallDisabledReason).toBeNull();
            expect(result.current.videoCallDisabledReason).toBeNull();
        });

        it("reopens closed slot before placing Element call if user is allowed to start", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            vi.mocked(room.hasEncryptionStateEvent).mockReturnValue(false);
            vi.mocked(matrixRTC.getRoomSession).mockReturnValue({
                slotId: "m.call#ROOM",
                getRtcSlot: vi.fn().mockReturnValue({ status: "closed", application: { type: "m.call" } }),
            } as unknown as ReturnType<typeof matrixRTC.getRoomSession>);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RTCSlot,
                { status: "open", application: { type: "m.call" } },
                "m.call#ROOM",
            );
            expect(placeCall).toHaveBeenCalled();
        });

        it("creates missing slot before placing Element call if user is allowed to start", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(undefined);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            vi.mocked(room.hasEncryptionStateEvent).mockReturnValue(false);
            vi.mocked(matrixRTC.getRoomSession).mockReturnValue({
                slotId: "m.call#ROOM",
                slotDescription: { application: "m.call", id: "ROOM" },
                getRtcSlot: vi.fn().mockReturnValue(undefined),
            } as unknown as ReturnType<typeof matrixRTC.getRoomSession>);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RTCSlot,
                { status: "open", application: { type: "m.call" } },
                "m.call#ROOM",
            );
            expect(placeCall).toHaveBeenCalled();
        });

        it("declares per-member encryption when creating slot in encrypted room", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(undefined);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            vi.mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
            vi.mocked(matrixRTC.getRoomSession).mockReturnValue({
                slotId: "m.call#ROOM",
                slotDescription: { application: "m.call", id: "ROOM" },
                getRtcSlot: vi.fn().mockReturnValue(undefined),
            } as unknown as ReturnType<typeof matrixRTC.getRoomSession>);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RTCSlot,
                {
                    status: "open",
                    application: { type: "m.call" },
                    encryption: { type: RTC_SLOT_ENCRYPTION_PER_MEMBER },
                },
                "m.call#ROOM",
            );
        });

        it("does not override already-declared encryption setting when reopening closed slot", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            vi.mocked(room.hasEncryptionStateEvent).mockReturnValue(false);
            vi.mocked(matrixRTC.getRoomSession).mockReturnValue({
                slotId: "m.call#ROOM",
                slotDescription: { application: "m.call", id: "ROOM" },
                getRtcSlot: vi.fn().mockReturnValue({
                    status: "closed",
                    application: { type: "m.call" },
                    encryption: { type: RTC_SLOT_ENCRYPTION_PER_MEMBER },
                }),
            } as unknown as ReturnType<typeof matrixRTC.getRoomSession>);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RTCSlot,
                {
                    status: "open",
                    application: { type: "m.call" },
                    encryption: { type: RTC_SLOT_ENCRYPTION_PER_MEMBER },
                },
                "m.call#ROOM",
            );
        });

        it("does not attempt to create slot for user without permissions", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(undefined);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockImplementation(
                (eventType) => eventType !== EventType.RTCSlot,
            );
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).not.toHaveBeenCalled();
            expect(placeCall).toHaveBeenCalled();
        });

        it("does not touch slot when placing call while slot is open", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(false);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(client.sendStateEvent).not.toHaveBeenCalled();
            expect(placeCall).toHaveBeenCalled();
        });

        it("shows error and does not place call if opening slot fails", async () => {
            vi.mocked(matrixRTC.isSlotClosed).mockReturnValue(true);
            vi.mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            vi.mocked(matrixRTC.getRoomSession).mockReturnValue({
                slotId: "m.call#ROOM",
                getRtcSlot: vi.fn().mockReturnValue({ status: "closed", application: { type: "m.call" } }),
            } as unknown as ReturnType<typeof matrixRTC.getRoomSession>);
            vi.mocked(client.sendStateEvent).mockRejectedValue(new Error("M_FORBIDDEN"));
            const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true]),
                close: vi.fn(),
            });
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toContain(PlatformCallType.ElementCall));

            await result.current.videoCallClick(undefined, PlatformCallType.ElementCall);

            expect(createDialog).toHaveBeenCalled();
            expect(placeCall).not.toHaveBeenCalled();
        });
    });
});
