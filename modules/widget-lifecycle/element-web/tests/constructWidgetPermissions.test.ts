/*
Copyright 2026 Element Creations Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { constructWidgetPermissions, sortLongestMatchLast } from "../src/utils/constructWidgetPermissions";

describe("constructWidgetPermissions", () => {
    it("finds exact match", () => {
        expect(constructWidgetPermissions({ "https://a.com/": { preload_approved: true } }, "https://a.com/")).toEqual({
            preload_approved: true,
        });
    });

    it("finds prefix match", () => {
        expect(
            constructWidgetPermissions({ "https://a.com/*": { preload_approved: true } }, "https://a.com/some"),
        ).toEqual({ preload_approved: true });
    });

    it("merges multiple permissions", () => {
        expect(
            constructWidgetPermissions(
                {
                    "https://b.com/path": {
                        preload_approved: false,
                        capabilities_approved: ["org.matrix.msc2762.timeline:*"],
                    },
                    "https://b.com/*": {
                        preload_approved: true,
                        identity_approved: true,
                        capabilities_approved: ["org.matrix.msc2931.navigate"],
                    },
                },
                "https://b.com/path",
            ),
        ).toEqual({
            preload_approved: false,
            identity_approved: true,
            capabilities_approved: ["org.matrix.msc2762.timeline:*"],
        });
    });

    it("skips unknown url", () => {
        expect(constructWidgetPermissions({ "https://a.com/": { preload_approved: true } }, "https://a.com/x")).toEqual(
            {},
        );
    });
});

describe("sortLongestMatchLast", () => {
    it("sorts longest match last", () => {
        expect(
            [
                "org.matrix.msc2762.receive.state_event:*",
                "org.matrix.msc2762.receive.*",
                "org.matrix.msc2762.receive.state_event:m.custom*",
                "org.matrix.msc2762.receive.state_event:m.custom#state_key",
                "org.matrix.msc2762.receive.state_event:m.custom#*",
                "*",
            ].sort(sortLongestMatchLast),
        ).toEqual([
            "*",
            "org.matrix.msc2762.receive.*",
            "org.matrix.msc2762.receive.state_event:*",
            "org.matrix.msc2762.receive.state_event:m.custom*",
            "org.matrix.msc2762.receive.state_event:m.custom#*",
            "org.matrix.msc2762.receive.state_event:m.custom#state_key",
        ]);
    });
});
