/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import { CallStore } from "../../../stores/CallStore";
import { type Call, type ElementCall } from "../../../models/Call";
import { type ElementCallHostBridge } from "./ElementCallComponentTypes";
import { ElementWebHostBridge } from "./ElementWebHostBridge";

describe("ElementWebHostBridge", () => {
    const widgetId = "widget1";
    const roomId = "!1:example.org";
    let call: {
        roomId: string;
        markReady: ReturnType<typeof vi.fn>;
        handleJoined: ReturnType<typeof vi.fn>;
        handleHangup: ReturnType<typeof vi.fn>;
        handleClose: ReturnType<typeof vi.fn>;
        handleDeviceMute: ReturnType<typeof vi.fn>;
    };
    let setWidgetPersistence: ReturnType<typeof vi.spyOn>;
    let bridge: ElementWebHostBridge;

    beforeEach(() => {
        call = {
            roomId,
            markReady: vi.fn(),
            handleJoined: vi.fn(),
            handleHangup: vi.fn(),
            handleClose: vi.fn(),
            handleDeviceMute: vi.fn(),
        };
        setWidgetPersistence = vi
            .spyOn(ActiveWidgetStore.instance, "setWidgetPersistence")
            .mockImplementation(() => {});
        bridge = new ElementWebHostBridge(call as unknown as ElementCall, { widgetId, widgetRoomId: roomId });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("forwards what Element Call tells the host to the call model", async () => {
        await bridge.contentLoaded();
        expect(call.markReady).toHaveBeenCalled();
        await bridge.notifyJoined();
        expect(call.handleJoined).toHaveBeenCalled();
        await bridge.notifyHungUp();
        expect(call.handleHangup).toHaveBeenCalled();
        await bridge.notifyDeviceMute({ audio_enabled: false, video_enabled: true });
        expect(call.handleDeviceMute).toHaveBeenCalledWith({ audio_enabled: false, video_enabled: true });
        await bridge.close();
        expect(call.handleClose).toHaveBeenCalled();
    });

    it("works when Element Call calls a callback it took off the bridge", async () => {
        // The component reads `close` off the bridge to see whether it exists, and calls what it got
        const { close, notifyJoined } = bridge;
        await close();
        expect(call.handleClose).toHaveBeenCalled();
        await notifyJoined();
        expect(call.handleJoined).toHaveBeenCalled();
    });

    it("sets persistence when asked to stay on screen", async () => {
        await bridge.setAlwaysOnScreen(true);
        expect(setWidgetPersistence).toHaveBeenCalledWith(widgetId, roomId, true);
        await bridge.setAlwaysOnScreen(false);
        expect(setWidgetPersistence).toHaveBeenCalledWith(widgetId, roomId, false);
    });

    it("hangs up every other connected call before becoming persistent, but not when leaving the screen", async () => {
        const order: string[] = [];
        const otherCall = {
            disconnect: vi.fn(async () => {
                order.push("disconnect other");
            }),
        };
        const ownDisconnect = vi.fn(async () => {});
        (call as unknown as { disconnect: unknown }).disconnect = ownDisconnect;
        vi.spyOn(CallStore.instance, "connectedCalls", "get").mockReturnValue(
            new Set([call, otherCall] as unknown as Call[]),
        );
        setWidgetPersistence.mockImplementation(() => {
            order.push("persist");
        });

        await bridge.setAlwaysOnScreen(true);
        expect(order).toEqual(["disconnect other", "persist"]);
        expect(ownDisconnect).not.toHaveBeenCalled();

        await bridge.setAlwaysOnScreen(false);
        expect(otherCall.disconnect).toHaveBeenCalledTimes(1);
    });

    it("supports reactions and vouches for the intent, as Element Web's widget host does", () => {
        const hostBridge: ElementCallHostBridge = bridge;
        expect(hostBridge.supportsReactions).toBe(true);
        expect(hostBridge.allowJoinUnmutedViaIntent).toBe(true);
    });
});
