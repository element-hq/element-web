/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { parseWidgetLifecycleConfig } from "../src/config";

describe("parseWidgetLifecycleConfig", () => {
    it("accepts missing configuration", () => {
        expect(parseWidgetLifecycleConfig(undefined)).toEqual({});
    });

    it("accepts empty configuration", () => {
        expect(parseWidgetLifecycleConfig({})).toEqual({});
    });

    it("accepts valid configuration", () => {
        expect(
            parseWidgetLifecycleConfig({
                widget_permissions: {
                    "https://localhost": {
                        preload_approved: true,
                        identity_approved: false,
                        capabilities_approved: [],
                    },
                },
            }),
        ).toEqual({
            "https://localhost": {
                preload_approved: true,
                identity_approved: false,
                capabilities_approved: [],
            },
        });
    });

    it("accepts additional properties", () => {
        expect(
            parseWidgetLifecycleConfig({
                widget_permissions: {
                    "https://localhost": {
                        preload_approved: true,
                        identity_approved: false,
                        capabilities_approved: ["capability"],
                        additional: "tmp",
                    },
                },
            }),
        ).toEqual({
            "https://localhost": {
                preload_approved: true,
                identity_approved: false,
                capabilities_approved: ["capability"],
                additional: "tmp",
            },
        });
    });

    it.each([
        { preload_approved: null },
        { preload_approved: 123 },
        { identity_approved: null },
        { identity_approved: 123 },
        { capabilities_approved: null },
        { capabilities_approved: 123 },
        { capabilities_approved: [undefined] },
        { capabilities_approved: [null] },
        { capabilities_approved: [123] },
        { capabilities_approved: [""] },
    ])("rejects invalid widget configuration %j", (patch) => {
        expect(() =>
            parseWidgetLifecycleConfig({
                widget_permissions: {
                    "https://localhost": {
                        preload_approved: true,
                        identity_approved: false,
                        capabilities_approved: ["capability"],
                        ...patch,
                    },
                },
            }),
        ).toThrow();
    });
});
