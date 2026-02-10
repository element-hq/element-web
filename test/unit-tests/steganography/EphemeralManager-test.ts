/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { EphemeralManager } from "../../../src/steganography/ephemeral/EphemeralManager";

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("EphemeralManager", () => {
    let manager: EphemeralManager;

    beforeEach(() => {
        jest.useFakeTimers();
        localStorageMock.clear();
        manager = new EphemeralManager({
            checkIntervalMs: 1000,
            defaultExpiryMs: 72 * 60 * 60 * 1000,
            serverSideRedaction: false, // Don't try to contact Matrix server in tests
        });
    });

    afterEach(() => {
        manager.stop();
        jest.useRealTimers();
    });

    describe("track", () => {
        it("should track a new ephemeral message", () => {
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
            manager.track("$event1", "!room1:example.com", expiresAt);

            const records = manager.getAllRecords();
            expect(records.length).toBe(1);
            expect(records[0].eventId).toBe("$event1");
            expect(records[0].roomId).toBe("!room1:example.com");
            expect(records[0].expiresAt).toBe(expiresAt);
        });

        it("should track multiple messages", () => {
            manager.track("$event1", "!room1:example.com", Date.now() + 1000);
            manager.track("$event2", "!room1:example.com", Date.now() + 2000);
            manager.track("$event3", "!room2:example.com", Date.now() + 3000);

            expect(manager.getAllRecords().length).toBe(3);
        });
    });

    describe("markRead", () => {
        it("should mark a message as read", () => {
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
            manager.track("$event1", "!room1:example.com", expiresAt);

            manager.markRead("$event1");

            const records = manager.getAllRecords();
            expect(records[0].read).toBe(true);
            expect(records[0].displayedAt).toBeDefined();
        });

        it("should handle marking unknown event", () => {
            // Should not throw
            manager.markRead("$unknown");
        });

        it("should trigger self-destruct on read", () => {
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
            manager.track("$event1", "!room1:example.com", expiresAt, true);

            manager.markRead("$event1");

            // Self-destruct message should be removed immediately
            expect(manager.getAllRecords().length).toBe(0);
        });
    });

    describe("getRemainingTime", () => {
        it("should return remaining time for a tracked message", () => {
            const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
            manager.track("$event1", "!room1:example.com", expiresAt);

            const remaining = manager.getRemainingTime("$event1");
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(60 * 60 * 1000);
        });

        it("should return 0 for expired messages", () => {
            const expiresAt = Date.now() - 1000; // Already expired
            manager.track("$event1", "!room1:example.com", expiresAt);

            expect(manager.getRemainingTime("$event1")).toBe(0);
        });

        it("should return -1 for unknown events", () => {
            expect(manager.getRemainingTime("$unknown")).toBe(-1);
        });
    });

    describe("isExpired", () => {
        it("should detect expired messages", () => {
            manager.track("$event1", "!room1:example.com", Date.now() - 1000);
            expect(manager.isExpired("$event1")).toBe(true);
        });

        it("should detect non-expired messages", () => {
            manager.track("$event1", "!room1:example.com", Date.now() + 100000);
            expect(manager.isExpired("$event1")).toBe(false);
        });
    });

    describe("getRecordsForRoom", () => {
        it("should filter records by room ID", () => {
            manager.track("$e1", "!room1:example.com", Date.now() + 1000);
            manager.track("$e2", "!room1:example.com", Date.now() + 1000);
            manager.track("$e3", "!room2:example.com", Date.now() + 1000);

            const room1Records = manager.getRecordsForRoom("!room1:example.com");
            expect(room1Records.length).toBe(2);

            const room2Records = manager.getRecordsForRoom("!room2:example.com");
            expect(room2Records.length).toBe(1);

            const room3Records = manager.getRecordsForRoom("!room3:example.com");
            expect(room3Records.length).toBe(0);
        });
    });

    describe("calculateExpiry", () => {
        it("should calculate default expiry (72 hours)", () => {
            const before = Date.now();
            const expiry = manager.calculateExpiry();
            const after = Date.now();

            const expectedMin = before + 72 * 60 * 60 * 1000;
            const expectedMax = after + 72 * 60 * 60 * 1000;

            expect(expiry).toBeGreaterThanOrEqual(expectedMin);
            expect(expiry).toBeLessThanOrEqual(expectedMax);
        });

        it("should calculate custom expiry", () => {
            const before = Date.now();
            const expiry = manager.calculateExpiry(60 * 60 * 1000); // 1 hour
            const after = Date.now();

            expect(expiry).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
            expect(expiry).toBeLessThanOrEqual(after + 60 * 60 * 1000);
        });
    });

    describe("createExpiryContent", () => {
        it("should create Matrix event content with expiry metadata", () => {
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
            const content = manager.createExpiryContent(expiresAt);

            expect(content["io.element.stego"]).toBeDefined();
            const stego = content["io.element.stego"] as Record<string, unknown>;
            expect(stego.ephemeral).toBe(true);
            expect(stego.expires_at).toBe(expiresAt);
        });
    });

    describe("activeCount", () => {
        it("should count active messages", () => {
            manager.track("$e1", "!room:test", Date.now() + 100000);
            manager.track("$e2", "!room:test", Date.now() + 200000);
            manager.track("$e3", "!room:test", Date.now() - 1000); // expired

            expect(manager.activeCount).toBe(2);
        });
    });

    describe("persistence", () => {
        it("should save to localStorage on track", () => {
            manager.track("$e1", "!room:test", Date.now() + 1000);
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it("should save to localStorage on markRead", () => {
            manager.track("$e1", "!room:test", Date.now() + 100000);
            localStorageMock.setItem.mockClear();

            manager.markRead("$e1");
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });
});
