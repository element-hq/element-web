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
    });
});
