/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Subject } from "rxjs";

import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import { CallStore } from "../../../stores/CallStore";
import { type Call, type ElementCall } from "../../../models/Call";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type HostBridge, type HostRequest } from "./ElementCallComponentTypes";
import { ElementWebHostBridge } from "./ElementWebHostBridge";

describe("ElementWebHostBridge", () => {
    const widgetId = "widget1";
    const roomId = "!1:example.org";
    let call: {
        markReady: ReturnType<typeof vi.fn>;
        handleJoined: ReturnType<typeof vi.fn>;
        handleHangup: ReturnType<typeof vi.fn>;
        handleClose: ReturnType<typeof vi.fn>;
        handleDeviceMute: ReturnType<typeof vi.fn>;
        hangUpRequests$: Subject<HostRequest<Record<string, never>>>;
    };
    let setWidgetPersistence: ReturnType<typeof vi.spyOn>;
    let bridge: ElementWebHostBridge;

    beforeEach(() => {
        call = {
            markReady: vi.fn(),
            handleJoined: vi.fn(),
            handleHangup: vi.fn(),
            handleClose: vi.fn(),
            handleDeviceMute: vi.fn(),
            hangUpRequests$: new Subject(),
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

    it("exposes the model's hang-up requests as hangUp$", () => {
        const received: HostRequest<Record<string, never>>[] = [];
        bridge.hangUp$.subscribe((req) => received.push(req));
        const request = { data: {}, reply: vi.fn() };
        call.hangUpRequests$.next(request);
        expect(received).toEqual([request]);
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

    it("has no host-driven join or mute requests and supports reactions", () => {
        const next = vi.fn();
        bridge.join$.subscribe(next);
        bridge.deviceMute$.subscribe(next);
        expect(next).not.toHaveBeenCalled();
        expect(bridge.supportsReactions).toBe(true);
        // Element Call has the client and fetches media itself
        expect((bridge as HostBridge).downloadMedia).toBeUndefined();
    });

    it("forwards theme changes while started", () => {
        const received: HostRequest<{ name?: string }>[] = [];
        bridge.themeChange$.subscribe((req) => received.push(req));

        bridge.start();
        dis.dispatch({ action: Action.RecheckTheme, forceTheme: "some-new-theme" }, true);
        expect(received.map((r) => r.data)).toEqual([{ name: "some-new-theme" }]);

        bridge.stop();
        dis.dispatch({ action: Action.RecheckTheme, forceTheme: "another-theme" }, true);
        expect(received).toHaveLength(1);
    });
});
