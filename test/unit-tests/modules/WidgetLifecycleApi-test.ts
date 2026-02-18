/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { WidgetDescriptor } from "@element-hq/element-web-module-api";

import { WidgetLifecycleApi, toWidgetDescriptor } from "../../../src/modules/WidgetLifecycleApi";
import { Widget, WidgetKind } from "matrix-widget-api";

const mkDescriptor = (overrides: Partial<WidgetDescriptor> = {}): WidgetDescriptor => ({
    id: "test-widget",
    templateUrl: "https://example.org/widget",
    creatorUserId: "@alice:example.org",
    type: "m.custom",
    origin: "https://example.org",
    kind: "room",
    roomId: "!room:example.org",
    ...overrides,
});

describe("WidgetLifecycleApi", () => {
    let api: WidgetLifecycleApi;

    beforeEach(() => {
        api = new WidgetLifecycleApi();
    });

    describe("toWidgetDescriptor", () => {
        it("converts a Widget to a WidgetDescriptor for a room widget", () => {
            const widget = new Widget({
                id: "w1",
                creatorUserId: "@bob:example.org",
                type: "m.jitsi",
                url: "https://jitsi.example.org/meet?conf=$matrix_room_id",
            });
            const descriptor = toWidgetDescriptor(widget, WidgetKind.Room, "!room:example.org");
            expect(descriptor).toEqual({
                id: "w1",
                templateUrl: "https://jitsi.example.org/meet?conf=$matrix_room_id",
                creatorUserId: "@bob:example.org",
                type: "m.jitsi",
                origin: "https://jitsi.example.org",
                roomId: "!room:example.org",
                kind: "room",
            });
        });

        it("maps Account widget kind", () => {
            const widget = new Widget({
                id: "w1",
                creatorUserId: "@bob:example.org",
                type: "m.custom",
                url: "https://example.org",
            });
            const descriptor = toWidgetDescriptor(widget, WidgetKind.Account);
            expect(descriptor.kind).toBe("account");
            expect(descriptor.roomId).toBeUndefined();
        });

        it("maps Modal widget kind", () => {
            const widget = new Widget({
                id: "w1",
                creatorUserId: "@bob:example.org",
                type: "m.custom",
                url: "https://example.org",
            });
            const descriptor = toWidgetDescriptor(widget, WidgetKind.Modal);
            expect(descriptor.kind).toBe("modal");
        });
    });

    describe("registerPreloadApprover", () => {
        it("accepts a single registration", () => {
            expect(() => api.registerPreloadApprover(() => true)).not.toThrow();
        });

        it("throws on double registration", () => {
            api.registerPreloadApprover(() => true);
            expect(() => api.registerPreloadApprover(() => true)).toThrow(
                "Widget lifecycle preload approver already registered",
            );
        });
    });

    describe("registerIdentityApprover", () => {
        it("accepts a single registration", () => {
            expect(() => api.registerIdentityApprover(() => true)).not.toThrow();
        });

        it("throws on double registration", () => {
            api.registerIdentityApprover(() => true);
            expect(() => api.registerIdentityApprover(() => true)).toThrow(
                "Widget lifecycle identity approver already registered",
            );
        });
    });

    describe("registerCapabilitiesApprover", () => {
        it("accepts a single registration", () => {
            expect(() => api.registerCapabilitiesApprover(() => new Set())).not.toThrow();
        });

        it("throws on double registration", () => {
            api.registerCapabilitiesApprover(() => new Set());
            expect(() => api.registerCapabilitiesApprover(() => new Set())).toThrow(
                "Widget lifecycle capabilities approver already registered",
            );
        });
    });

    describe("preapprovePreload", () => {
        const widget = mkDescriptor();

        it("returns false when no approver registered", async () => {
            expect(await api.preapprovePreload(widget)).toBe(false);
        });

        it("returns true when approver returns true", async () => {
            api.registerPreloadApprover(() => true);
            expect(await api.preapprovePreload(widget)).toBe(true);
        });

        it("returns false when approver returns false", async () => {
            api.registerPreloadApprover(() => false);
            expect(await api.preapprovePreload(widget)).toBe(false);
        });

        it("returns false when approver returns undefined", async () => {
            api.registerPreloadApprover(() => undefined);
            expect(await api.preapprovePreload(widget)).toBe(false);
        });

        it("returns false and logs error when approver throws", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation();
            api.registerPreloadApprover(() => {
                throw new Error("boom");
            });
            expect(await api.preapprovePreload(widget)).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith("Widget preload approver failed", expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe("preapproveIdentity", () => {
        const widget = mkDescriptor();

        it("returns false when no approver registered", async () => {
            expect(await api.preapproveIdentity(widget)).toBe(false);
        });

        it("returns true when approver returns true", async () => {
            api.registerIdentityApprover(() => true);
            expect(await api.preapproveIdentity(widget)).toBe(true);
        });

        it("returns false when approver returns false", async () => {
            api.registerIdentityApprover(() => false);
            expect(await api.preapproveIdentity(widget)).toBe(false);
        });

        it("returns false when approver returns undefined", async () => {
            api.registerIdentityApprover(() => undefined);
            expect(await api.preapproveIdentity(widget)).toBe(false);
        });

        it("returns false and logs error when approver throws", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation();
            api.registerIdentityApprover(() => {
                throw new Error("boom");
            });
            expect(await api.preapproveIdentity(widget)).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith("Widget identity approver failed", expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe("preapproveCapabilities", () => {
        const widget = mkDescriptor();
        const requested = new Set(["cap1", "cap2", "cap3"]);

        it("returns undefined when no approver registered", async () => {
            expect(await api.preapproveCapabilities(widget, requested)).toBeUndefined();
        });

        it("returns the set from the approver", async () => {
            api.registerCapabilitiesApprover(() => new Set(["cap1", "cap2"]));
            expect(await api.preapproveCapabilities(widget, requested)).toEqual(new Set(["cap1", "cap2"]));
        });

        it("passes widget and requested capabilities to the approver", async () => {
            const approver = jest.fn().mockReturnValue(new Set(["cap1"]));
            api.registerCapabilitiesApprover(approver);
            await api.preapproveCapabilities(widget, requested);
            expect(approver).toHaveBeenCalledWith(widget, requested);
        });

        it("returns undefined when approver returns undefined", async () => {
            api.registerCapabilitiesApprover(() => undefined);
            expect(await api.preapproveCapabilities(widget, requested)).toBeUndefined();
        });

        it("returns undefined and logs error when approver throws", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation();
            api.registerCapabilitiesApprover(() => {
                throw new Error("boom");
            });
            expect(await api.preapproveCapabilities(widget, requested)).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith("Widget capabilities approver failed", expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
