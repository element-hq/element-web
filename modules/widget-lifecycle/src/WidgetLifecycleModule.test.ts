/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, expect, it } from "vitest";

import WidgetLifecycleModule, { type WidgetLifecycleApiAdapter } from "./WidgetLifecycleModule";
import type {
    CapabilitiesApprover,
    IdentityApprover,
    PreloadApprover,
    WidgetDescriptor,
    Api,
} from "@element-hq/element-web-module-api";

const createApi = (config: unknown = {}) => {
    const handlers: {
        preload?: PreloadApprover;
        identity?: IdentityApprover;
        capabilities?: CapabilitiesApprover;
    } = {};

    const widgetLifecycle: WidgetLifecycleApiAdapter = {
        registerPreloadApprover: vi.fn((approver) => {
            handlers.preload = approver;
        }),
        registerIdentityApprover: vi.fn((approver) => {
            handlers.identity = approver;
        }),
        registerCapabilitiesApprover: vi.fn((approver) => {
            handlers.capabilities = approver;
        }),
    };

    return {
        api: {
            config: {
                get: () => config,
            },
            widgetLifecycle,
        } as Api,
        handlers,
    };
};

const widget: WidgetDescriptor = {
    id: "widget-id",
    templateUrl: "https://example.com/",
    creatorUserId: "@user-id",
    type: "com.example.custom",
    origin: "example.com",
};

describe("WidgetLifecycleModule", () => {
    it("does nothing when no config is present", async () => {
        const { api } = createApi(null);

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(api.widgetLifecycle.registerPreloadApprover).not.toHaveBeenCalled();
        expect(api.widgetLifecycle.registerIdentityApprover).not.toHaveBeenCalled();
        expect(api.widgetLifecycle.registerCapabilitiesApprover).not.toHaveBeenCalled();
    });

    it("approves preload when configured", async () => {
        const { api, handlers } = createApi({
            widget_permissions: {
                "https://example.com/": { preload_approved: true },
            },
        });

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(await handlers.preload?.(widget)).toBe(true);
    });

    it("approves identity when configured", async () => {
        const { api, handlers } = createApi({
            widget_permissions: {
                "https://example.com/": { identity_approved: true },
            },
        });

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(await handlers.identity?.(widget)).toBe(true);
    });

    it("approves configured capabilities", async () => {
        const { api, handlers } = createApi({
            widget_permissions: {
                "https://example.com/": {
                    capabilities_approved: ["org.matrix.msc2931.navigate"],
                },
            },
        });

        const module = new WidgetLifecycleModule(api);
        await module.load();

        const approved = await handlers.capabilities?.(
            widget,
            new Set(["org.matrix.msc2931.navigate", "org.matrix.msc2762.timeline:*"]),
        );

        expect(approved).toEqual(new Set(["org.matrix.msc2931.navigate"]));
    });

    it("returns no approvals when not configured", async () => {
        const { api, handlers } = createApi({});

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(await handlers.preload?.(widget)).toBe(false);
        expect(await handlers.identity?.(widget)).toBe(false);
        expect(await handlers.capabilities?.(widget, new Set(["org.matrix.msc2931.navigate"]))).toBeUndefined();
    });

    it("returns no approvals when config is missing", async () => {
        const { api, handlers } = createApi(undefined);

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(await handlers.preload?.(widget)).toBe(false);
        expect(await handlers.identity?.(widget)).toBe(false);
        expect(await handlers.capabilities?.(widget, new Set(["org.matrix.msc2931.navigate"]))).toBeUndefined();
    });

    it("fails closed on invalid config", async () => {
        const { api, handlers } = createApi({
            widget_permissions: {
                "https://example.com/": {
                    preload_approved: null,
                },
            },
        });

        const module = new WidgetLifecycleModule(api);
        await module.load();

        expect(await handlers.preload?.(widget)).toBe(false);
        expect(await handlers.identity?.(widget)).toBe(false);
        expect(await handlers.capabilities?.(widget, new Set(["org.matrix.msc2931.navigate"]))).toBeUndefined();
    });
});
