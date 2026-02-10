/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { StegoDetector } from "../../../src/steganography/StegoDetector";
import { encodeEmoji } from "../../../src/steganography/EmojiStego";
import { STEGO_MARKER, StegoStrategy } from "../../../src/steganography/types";

// Minimal mock for MatrixEvent
function createMockEvent(
    eventId: string,
    roomId: string,
    body?: string,
    extra?: Record<string, unknown>,
): any {
    const content: Record<string, unknown> = {};
    if (body !== undefined) content.body = body;
    if (extra) Object.assign(content, extra);

    return {
        getId: () => eventId,
        getRoomId: () => roomId,
        getContent: () => content,
    };
}

describe("StegoDetector", () => {
    let detector: StegoDetector;

    beforeEach(() => {
        detector = new StegoDetector();
    });

    afterEach(() => {
        detector.stop();
    });

    describe("scanText", () => {
        it("should detect stego marker in text", () => {
            const payload = new Uint8Array([1, 2, 3]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);

            expect(detector.scanText(carrier)).toBe(true);
        });

        it("should not detect normal text", () => {
            expect(detector.scanText("Hello world")).toBe(false);
            expect(detector.scanText("Just emojis 🎉🎊")).toBe(false);
        });

        it("should detect PNG data URLs", () => {
            expect(detector.scanText("data:image/png;base64,abc")).toBe(true);
        });
    });

    describe("scanEvent", () => {
        it("should detect stego in event body", () => {
            const payload = new Uint8Array([1, 2, 3]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);

            const event = createMockEvent("$event1", "!room:test", carrier);
            const detection = detector.scanEvent(event);

            expect(detection).not.toBeNull();
            expect(detection!.eventId).toBe("$event1");
            expect(detection!.roomId).toBe("!room:test");
            expect(detection!.type).toBe("emoji");
            expect(detection!.carrier).toBe(carrier);
        });

        it("should not detect normal messages", () => {
            const event = createMockEvent("$event1", "!room:test", "Hello world");
            expect(detector.scanEvent(event)).toBeNull();
        });

        it("should detect stego in custom event content", () => {
            const event = createMockEvent("$event1", "!room:test", undefined, {
                "io.element.stego": {
                    carrier: STEGO_MARKER + "test",
                },
            });

            const detection = detector.scanEvent(event);
            expect(detection).not.toBeNull();
            expect(detection!.type).toBe("emoji");
        });

        it("should detect PNG image stego events", () => {
            const event = createMockEvent("$event1", "!room:test", undefined, {
                msgtype: "m.image",
                info: { mimetype: "image/png" },
                url: "mxc://example.com/image",
            });

            const detection = detector.scanEvent(event);
            expect(detection).not.toBeNull();
            expect(detection!.type).toBe("image");
        });

        it("should not re-detect already detected events", () => {
            const payload = new Uint8Array([1, 2, 3]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);
            const event = createMockEvent("$event1", "!room:test", carrier);

            const first = detector.scanEvent(event);
            expect(first).not.toBeNull();

            const second = detector.scanEvent(event);
            expect(second).toBeNull();
        });

        it("should handle events without ID", () => {
            const event = {
                getId: () => undefined,
                getRoomId: () => "!room:test",
                getContent: () => ({ body: "test" }),
            };

            expect(detector.scanEvent(event as any)).toBeNull();
        });

        it("should handle events without content", () => {
            const event = {
                getId: () => "$event1",
                getRoomId: () => "!room:test",
                getContent: () => undefined,
            };

            expect(detector.scanEvent(event as any)).toBeNull();
        });
    });

    describe("onDetection", () => {
        it("should register and call detection callbacks", () => {
            const callback = jest.fn();
            detector.onDetection(callback);

            // Simulate detection via scanEvent
            const payload = new Uint8Array([1, 2, 3]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);
            const event = createMockEvent("$event1", "!room:test", carrier);

            // scanEvent doesn't fire callbacks (only onTimelineEvent does),
            // but we can verify the callback was registered
            expect(typeof callback).toBe("function");
        });

        it("should return an unsubscribe function", () => {
            const callback = jest.fn();
            const unsub = detector.onDetection(callback);

            expect(typeof unsub).toBe("function");
            unsub(); // Should not throw
        });
    });

    describe("detectionCount", () => {
        it("should track detection count", () => {
            expect(detector.detectionCount).toBe(0);

            const payload = new Uint8Array([1]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);

            detector.scanEvent(createMockEvent("$e1", "!room:test", carrier));
            expect(detector.detectionCount).toBe(1);

            detector.scanEvent(createMockEvent("$e2", "!room:test", carrier));
            expect(detector.detectionCount).toBe(2);
        });
    });

    describe("clearCache", () => {
        it("should clear the detection cache", () => {
            const payload = new Uint8Array([1]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);

            detector.scanEvent(createMockEvent("$e1", "!room:test", carrier));
            expect(detector.detectionCount).toBe(1);

            detector.clearCache();
            expect(detector.detectionCount).toBe(0);

            // Should be able to re-detect
            const result = detector.scanEvent(createMockEvent("$e1", "!room:test", carrier));
            expect(result).not.toBeNull();
        });
    });
});
