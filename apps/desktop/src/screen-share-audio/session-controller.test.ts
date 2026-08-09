/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import type { DesktopCapturerSource, Streams } from "electron";

import { DisplayMediaSessionController, type DisplayMediaSessionDependencies } from "./session-controller.js";
import type {
    PreparedScreenShareAudioBridge,
    PreparedScreenShareAudioCapture,
    ScreenShareAudioProvider,
} from "./types.js";

const source = (id = "window:123:0"): DesktopCapturerSource =>
    ({ id, name: "not logged", display_id: "", appIcon: null, thumbnail: {} }) as unknown as DesktopCapturerSource;

const tick = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
};

function harness(
    overrides: Partial<DisplayMediaSessionDependencies> = {},
    audioRequested = true,
): {
    controller: DisplayMediaSessionController;
    callbacks: Streams[];
    picker: ReturnType<typeof vi.fn>;
    destroyRequester: () => void;
} {
    const callbacks: Streams[] = [];
    const picker = vi.fn(() => true);
    let requesterListener = (): void => {};
    const controller = new DisplayMediaSessionController({
        enumerateSources: async () => [source()],
        openPicker: picker,
        isElementOwnedSource: () => false,
        ...overrides,
    });
    controller.begin({
        senderId: 7,
        requesterWidgetId: "widget",
        audioRequested,
        callback: (streams) => callbacks.push(streams),
        onRequesterDestroyed: (listener) => {
            requesterListener = listener;
            return vi.fn();
        },
    });
    controller.bind(7, {
        requestId: 1,
        requesterWidgetId: "widget",
        sessionId: "12345678-1234-4123-8123-123456789abc",
    });
    return { controller, callbacks, picker, destroyRequester: () => requesterListener() };
}

describe("DisplayMediaSessionController", () => {
    const capture = (): PreparedScreenShareAudioCapture =>
        ({
            format: { sampleRate: 48_000, channelCount: 2, sampleFormat: "pcm-s16le" },
            start: vi.fn(),
            onTerminal: vi.fn(() => vi.fn()),
            stop: vi.fn(),
        }) as PreparedScreenShareAudioCapture;

    it("opens the picker with a monotonic request id and cancels exactly once without preparing audio", async () => {
        const prepare = vi.fn();
        const { controller, callbacks, picker } = harness({
            provider: { getAvailability: async () => "available", prepare },
        });
        await tick();
        expect(picker).toHaveBeenCalledWith(7, 1, "widget");
        controller.reply(7, { requestId: 1, sourceId: null });
        controller.reply(7, { requestId: 1, sourceId: null });
        await tick();
        expect(callbacks).toHaveLength(1);
        expect(callbacks[0].video).toMatchObject({ id: "" });
        expect(prepare).not.toHaveBeenCalled();
        expect(controller.state).toBe("Idle");
    });

    it("ignores stale and wrong-sender replies", async () => {
        const { controller, callbacks } = harness();
        await tick();
        controller.reply(8, { requestId: 1, sourceId: source().id });
        controller.reply(7, { requestId: 99, sourceId: source().id });
        await tick();
        expect(callbacks).toHaveLength(0);
        expect(controller.state).toBe("Selecting");
    });

    it("re-enumerates the exact source and rejects malformed or stale video", async () => {
        const enumerateSources = vi.fn(async () => [source("window:other:0")]);
        const { controller, callbacks } = harness({ enumerateSources });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: "bogus" });
        await tick();
        expect(enumerateSources).toHaveBeenCalledOnce();
        expect(callbacks[0].video).toMatchObject({ id: "" });
        expect(controller.state).toBe("Idle");
    });

    it("serializes replacement and rejects the old callback before opening the next picker", async () => {
        const first = harness();
        await tick();
        const secondCallback = vi.fn();
        first.controller.begin({
            senderId: 7,
            requesterWidgetId: "widget",
            audioRequested: true,
            callback: secondCallback,
            onRequesterDestroyed: () => vi.fn(),
        });
        await tick();
        expect(first.callbacks).toHaveLength(1);
        expect(first.picker.mock.calls).toEqual([
            [7, 1, "widget"],
            [7, 2, "widget"],
        ]);
        expect(secondCallback).not.toHaveBeenCalled();
    });

    it.each(["unavailable", "unsupported"] as const)(
        "returns video-only when the provider is %s",
        async (availability) => {
            const prepare = vi.fn();
            const { controller, callbacks } = harness({
                provider: { getAvailability: async () => availability, prepare },
            });
            await tick();
            controller.reply(7, { requestId: 1, sourceId: source().id });
            await tick();
            expect(callbacks[0]).toEqual({ video: expect.objectContaining({ id: source().id }) });
            expect(prepare).not.toHaveBeenCalled();
            expect(controller.getAudit()).toMatchObject({ state: "Idle", activeRequests: 0 });
        },
    );

    it("releases ownership immediately when audio was not requested", async () => {
        const prepare = vi.fn();
        const { controller, callbacks } = harness(
            { provider: { getAvailability: async () => "available", prepare } },
            false,
        );
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(callbacks[0]).toEqual({ video: expect.objectContaining({ id: source().id }) });
        expect(prepare).not.toHaveBeenCalled();
        expect(controller.getAudit()).toMatchObject({
            state: "Idle",
            activeRequests: 0,
            activeCaptures: 0,
            activeBridges: 0,
        });
    });

    it("releases ownership immediately when no audio provider is installed", async () => {
        const { controller, callbacks } = harness();
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(callbacks[0]).toEqual({ video: expect.objectContaining({ id: source().id }) });
        expect(controller.getAudit()).toMatchObject({
            state: "Idle",
            activeRequests: 0,
            activeCaptures: 0,
            activeBridges: 0,
        });
    });

    it("returns Element-owned window selections as video-only", async () => {
        const prepare = vi.fn();
        const { controller, callbacks } = harness({
            isElementOwnedSource: () => true,
            provider: { getAvailability: async () => "available", prepare },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(callbacks[0].audio).toBeUndefined();
        expect(prepare).not.toHaveBeenCalled();
        expect(controller.getAudit()).toMatchObject({ state: "Idle", activeRequests: 0 });
    });

    it("owns a prepared bridge until its exact session is released and tears it down idempotently", async () => {
        const capture = {
            format: { sampleRate: 48_000, channelCount: 2, sampleFormat: "pcm-s16le" },
            start: vi.fn(),
            onTerminal: vi.fn(() => vi.fn()),
            stop: vi.fn(),
        } as PreparedScreenShareAudioCapture;
        const bridge = {
            frame: { routingId: 1 },
            port: {},
            waitForConsumerStop: () => new Promise(() => {}),
            waitForTerminal: () => new Promise(() => {}),
            stop: vi.fn(),
        } as unknown as PreparedScreenShareAudioBridge;
        const provider: ScreenShareAudioProvider = {
            getAvailability: async () => "available",
            prepare: async () => capture,
        };
        const { controller, callbacks } = harness({ provider, bridgeFactory: { prepare: async () => bridge } });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(callbacks[0]).toMatchObject({ audio: bridge.frame, enableLocalEcho: false });
        expect(controller.state).toBe("Active");
        await controller.release(7, {
            requestId: 1,
            requesterWidgetId: "widget",
            sessionId: "12345678-1234-4123-8123-123456789abc",
        });
        await controller.stop();
        expect(bridge.stop).toHaveBeenCalledOnce();
        expect(controller.state).toBe("Idle");
        expect(controller.getAudit()).toEqual({
            state: "Idle",
            activeRequests: 0,
            activeCaptures: 0,
            activeBridges: 0,
            completedCallbacks: 1,
            lastRequestId: 1,
        });
    });

    it("cleans partial preparation and prevents a stale completion after replacement", async () => {
        const deferred = Promise.withResolvers<PreparedScreenShareAudioCapture>();
        const capture = {
            format: { sampleRate: 48_000, channelCount: 2, sampleFormat: "pcm-s16le" },
            start: vi.fn(),
            onTerminal: vi.fn(() => vi.fn()),
            stop: vi.fn(),
        } as PreparedScreenShareAudioCapture;
        const provider: ScreenShareAudioProvider = {
            getAvailability: async () => "available",
            prepare: () => deferred.promise,
        };
        const { controller, callbacks } = harness({ provider, bridgeFactory: { prepare: vi.fn() } });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        controller.begin({
            senderId: 7,
            requesterWidgetId: "widget",
            audioRequested: true,
            callback: vi.fn(),
            onRequesterDestroyed: () => vi.fn(),
        });
        deferred.resolve(capture);
        await tick();
        expect(capture.stop).toHaveBeenCalledOnce();
        expect(callbacks).toHaveLength(1);
    });

    it("fails closed to video-only after provider preparation failure", async () => {
        const { controller, callbacks } = harness({
            provider: { getAvailability: async () => "available", prepare: async () => Promise.reject(new Error()) },
            bridgeFactory: { prepare: vi.fn() },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(callbacks[0].audio).toBeUndefined();
        expect(controller.getAudit()).toMatchObject({
            state: "Idle",
            activeRequests: 0,
            activeCaptures: 0,
            activeBridges: 0,
        });
    });

    it("stops an owned request when its requester is destroyed", async () => {
        const { controller, callbacks, destroyRequester } = harness();
        await tick();
        destroyRequester();
        await tick();
        expect(callbacks).toHaveLength(1);
        expect(controller.state).toBe("Idle");
    });

    it("does not let a pending-forever prepare block replacement", async () => {
        const provider: ScreenShareAudioProvider = {
            getAvailability: async () => "available",
            prepare: () => new Promise(() => {}),
        };
        const { controller, picker } = harness({ provider, bridgeFactory: { prepare: vi.fn() } });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        controller.begin({
            senderId: 7,
            requesterWidgetId: "widget",
            audioRequested: true,
            callback: vi.fn(),
            onRequesterDestroyed: () => vi.fn(),
        });
        await tick();
        expect(picker).toHaveBeenLastCalledWith(7, 2, "widget");
        expect(controller.state).toBe("Selecting");
    });

    it("invalidates immediately when requester destruction happens during enumeration", async () => {
        const enumeration = Promise.withResolvers<DesktopCapturerSource[]>();
        const { controller, callbacks, destroyRequester } = harness({ enumerateSources: () => enumeration.promise });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        destroyRequester();
        expect(callbacks).toHaveLength(1);
        await tick();
        expect(controller.state).toBe("Idle");
        enumeration.resolve([source()]);
    });

    it("cleans a late capture when requester destruction happens during provider preparation", async () => {
        const preparation = Promise.withResolvers<PreparedScreenShareAudioCapture>();
        const lateCapture = capture();
        const { controller, destroyRequester } = harness({
            provider: { getAvailability: async () => "available", prepare: () => preparation.promise },
            bridgeFactory: { prepare: vi.fn() },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        destroyRequester();
        preparation.resolve(lateCapture);
        await tick();
        expect(lateCapture.stop).toHaveBeenCalledOnce();
        expect(controller.state).toBe("Idle");
    });

    it("cleans a late bridge when requester destruction happens during bridge preparation", async () => {
        const bridgePreparation = Promise.withResolvers<PreparedScreenShareAudioBridge>();
        const ownedCapture = capture();
        const lateBridge = {
            frame: {},
            port: {},
            waitForConsumerStop: vi.fn(),
            waitForTerminal: vi.fn(() => new Promise(() => {})),
            stop: vi.fn(),
        } as unknown as PreparedScreenShareAudioBridge;
        const { controller, destroyRequester } = harness({
            provider: { getAvailability: async () => "available", prepare: async () => ownedCapture },
            bridgeFactory: { prepare: () => bridgePreparation.promise },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        destroyRequester();
        bridgePreparation.resolve(lateBridge);
        await tick();
        expect(ownedCapture.stop).toHaveBeenCalledOnce();
        expect(lateBridge.stop).toHaveBeenCalledOnce();
        expect(controller.state).toBe("Idle");
    });

    it("rejects exactly once and returns Idle when opening the picker throws", async () => {
        const { callbacks, controller } = harness({
            openPicker: () => {
                throw new Error("picker failed");
            },
        });
        await tick();
        expect(callbacks).toHaveLength(1);
        expect(controller.state).toBe("Idle");
    });

    it("accepts release while Selecting and ignores stale or cross-sender tuples", async () => {
        const { controller, callbacks } = harness();
        await tick();
        await controller.release(8, {
            requestId: 1,
            requesterWidgetId: "widget",
            sessionId: "12345678-1234-4123-8123-123456789abc",
        });
        await controller.release(7, {
            requestId: 1,
            requesterWidgetId: "other-widget",
            sessionId: "22345678-1234-4123-8123-123456789abc",
        });
        await controller.release(7, {
            requestId: 2,
            requesterWidgetId: "widget",
            sessionId: "12345678-1234-4123-8123-123456789abc",
        });
        expect(controller.state).toBe("Selecting");
        await controller.release(7, {
            requestId: 1,
            requesterWidgetId: "widget",
            sessionId: "12345678-1234-4123-8123-123456789abc",
        });
        expect(callbacks).toHaveLength(1);
        expect(controller.state).toBe("Idle");
    });

    it("aborts a pending preparation on exact release and cleans a late capture", async () => {
        const preparation = Promise.withResolvers<PreparedScreenShareAudioCapture>();
        const lateCapture = capture();
        const { controller } = harness({
            provider: { getAvailability: async () => "available", prepare: () => preparation.promise },
            bridgeFactory: { prepare: vi.fn() },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        await controller.release(7, {
            requestId: 1,
            requesterWidgetId: "widget",
            sessionId: "12345678-1234-4123-8123-123456789abc",
        });
        preparation.resolve(lateCapture);
        await tick();
        expect(lateCapture.stop).toHaveBeenCalledOnce();
        expect(controller.state).toBe("Idle");
    });

    it("returns Active to Idle exactly once when the bridge reports a terminal failure", async () => {
        const terminal = Promise.withResolvers<void>();
        const bridge = {
            frame: { routingId: 1 },
            port: {},
            waitForConsumerStop: () => new Promise(() => {}),
            waitForTerminal: () => terminal.promise,
            stop: vi.fn(),
        } as unknown as PreparedScreenShareAudioBridge;
        const { controller, callbacks } = harness({
            provider: { getAvailability: async () => "available", prepare: async () => capture() },
            bridgeFactory: { prepare: async () => bridge },
        });
        await tick();
        controller.reply(7, { requestId: 1, sourceId: source().id });
        await tick();
        expect(controller.state).toBe("Active");
        terminal.resolve();
        await tick();
        expect(callbacks).toHaveLength(1);
        expect(bridge.stop).toHaveBeenCalledOnce();
        expect(controller.getAudit()).toMatchObject({
            state: "Idle",
            activeRequests: 0,
            activeCaptures: 0,
            activeBridges: 0,
        });
    });
});
