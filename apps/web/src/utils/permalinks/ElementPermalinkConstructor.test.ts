/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import ElementPermalinkConstructor from "./ElementPermalinkConstructor";
import { PermalinkParts } from "./PermalinkConstructor";

describe("ElementPermalinkConstructor", () => {
    const permalinkConstructor = new ElementPermalinkConstructor("https://app.element.io");

    describe("parsePermalink", () => {
        it.each([
            ["repeated via servers", "?via=one.example.com&via=two.example.com"],
            ["an action before the via servers", "?action=join&via=one.example.com&via=two.example.com"],
            [
                "a custom parameter between via servers",
                "?via=one.example.com&org.example.key=value&via=two.example.com",
            ],
        ])("should read only the via servers from a room link with %s", (name: string, query: string) => {
            expect(
                permalinkConstructor.parsePermalink(`https://app.element.io/#/room/!room:example.com${query}`),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "", ["one.example.com", "two.example.com"]));
        });

        it("should read only the via servers from an event link with other parameters", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "https://app.element.io/#/room/!room:example.com/$event?via=one.example.com&org.example.key=value",
                ),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "$event", ["one.example.com"]));
        });
    });
});
