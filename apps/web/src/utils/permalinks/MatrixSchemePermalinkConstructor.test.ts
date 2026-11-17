/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { PermalinkParts } from "./PermalinkConstructor";
import MatrixSchemePermalinkConstructor from "./MatrixSchemePermalinkConstructor";

describe("MatrixSchemePermalinkConstructor", () => {
    const permalinkConstructor = new MatrixSchemePermalinkConstructor();

    describe("parsePermalink", () => {
        it("should strip ?action=chat from user links", () => {
            expect(permalinkConstructor.parsePermalink("matrix:u/user:example.com?action=chat")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });

        it("should keep via servers on room links", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "matrix:roomid/room:example.com?via=one.example.com&via=two.example.com",
                ),
            ).toEqual(PermalinkParts.forRoom("!room:example.com", ["one.example.com", "two.example.com"]));
            expect(permalinkConstructor.parsePermalink("matrix:r/alias:example.com?via=one.example.com")).toEqual(
                PermalinkParts.forRoom("#alias:example.com", ["one.example.com"]),
            );
        });

        it("should keep via servers on event links", () => {
            expect(
                permalinkConstructor.parsePermalink("matrix:roomid/room:example.com/e/event?via=one.example.com"),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "$event", ["one.example.com"]));
        });

        it.each([
            ["an action after the via servers", "?via=one.example.com&via=two.example.com&action=join"],
            ["an action before the via servers", "?action=join&via=one.example.com&via=two.example.com"],
            [
                "a custom parameter between via servers",
                "?via=one.example.com&org.example.key=value&via=two.example.com",
            ],
        ])("should read only the via servers from a room link with %s", (name: string, query: string) => {
            expect(permalinkConstructor.parsePermalink(`matrix:roomid/room:example.com${query}`)).toEqual(
                PermalinkParts.forRoom("!room:example.com", ["one.example.com", "two.example.com"]),
            );
        });

        it("should read only the via servers from an event link with other parameters", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "matrix:roomid/room:example.com/e/event?via=one.example.com&org.example.key=value",
                ),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "$event", ["one.example.com"]));
        });

        it("should percent-decode via servers", () => {
            expect(
                permalinkConstructor.parsePermalink("matrix:roomid/room:example.com?via=example.com%3A8448"),
            ).toEqual(PermalinkParts.forRoom("!room:example.com", ["example.com:8448"]));
        });

        it("should ignore an action and custom parameters on user links", () => {
            expect(
                permalinkConstructor.parsePermalink("matrix:u/user:example.com?action=chat&org.example.key=value"),
            ).toEqual(new PermalinkParts(null, null, "@user:example.com", null));
        });
    });
});
