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
import { type ElementCallHostBridge } from "@element-hq/element-call-component/api";
import { logger } from "matrix-js-sdk/src/logger";
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
        held: { audio_held: boolean; video_held: boolean };
        widget: { id: string; roomId: string };
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
            held: { audio_held: false, video_held: false },
            widget: { id: widgetId, roomId },
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

    it("puts every other connected call on hold before becoming persistent, but not when leaving the screen", async () => {
        const order: string[] = [];
        const notHeld = { audio_held: false, video_held: false };
        const otherCall = {
            held: notHeld,
            setHold: vi.fn(async () => {
                order.push("hold other");
            }),
            widget: { id: "other", roomId: "!other:example.org" },
        };
        const ownHold = vi.fn(async () => {});
        (call as unknown as { setHold: unknown }).setHold = ownHold;
        vi.spyOn(CallStore.instance, "connectedCalls", "get").mockReturnValue(
            new Set([call, otherCall] as unknown as Call[]),
        );
        setWidgetPersistence.mockImplementation(() => {
            order.push("persist");
        });

        await bridge.setAlwaysOnScreen(true);
        expect(order).toEqual(["hold other", "persist"]);
        // Only audio goes on hold: the other call's video keeps showing
        expect(otherCall.setHold).toHaveBeenCalledWith({ audio_held: true });
        expect(ownHold).not.toHaveBeenCalled();

        await bridge.setAlwaysOnScreen(false);
        expect(otherCall.setHold).toHaveBeenCalledTimes(1);
    });

    it("still becomes persistent when another call cannot be held", async () => {
        const notHeld = { audio_held: false, video_held: false };
        const failing = { held: notHeld, setHold: vi.fn(async () => Promise.reject(new Error("no hold for you"))) };
        const fine = { held: notHeld, setHold: vi.fn(async () => {}) };
        vi.spyOn(CallStore.instance, "connectedCalls", "get").mockReturnValue(
            new Set([call, failing, fine] as unknown as Call[]),
        );
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

        // The rejection must neither escape to Element Call nor stop this call from becoming sticky
        await expect(bridge.setAlwaysOnScreen(true)).resolves.toBeUndefined();
        expect(fine.setHold).toHaveBeenCalledTimes(1);
        expect(setWidgetPersistence).toHaveBeenCalledWith(widgetId, roomId, true);
        expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: "no hold for you" }));
    });

    it("supports reactions and vouches for the intent, as Element Web's widget host does", () => {
        const hostBridge: ElementCallHostBridge = bridge;
        expect(hostBridge.supportsReactions).toBe(true);
        expect(hostBridge.allowJoinUnmutedViaIntent).toBe(true);
    });
});
