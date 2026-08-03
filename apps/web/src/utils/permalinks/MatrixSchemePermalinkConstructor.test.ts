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
    const peramlinkConstructor = new MatrixSchemePermalinkConstructor();

    describe("parsePermalink", () => {
        it("should strip ?action=chat from user links", () => {
            expect(peramlinkConstructor.parsePermalink("matrix:u/user:example.com?action=chat")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });

        it("should parse via candidates on a room-ID link", () => {
            expect(
                peramlinkConstructor.parsePermalink("matrix:roomid/somewhere:example.org?via=one.org&via=two.org"),
            ).toEqual(new PermalinkParts("!somewhere:example.org", null, null, ["one.org", "two.org"]));
        });

        it("should parse via candidates on a room-alias link", () => {
            expect(
                peramlinkConstructor.parsePermalink("matrix:r/somewhere:example.org?via=one.org&via=two.org"),
            ).toEqual(new PermalinkParts("#somewhere:example.org", null, null, ["one.org", "two.org"]));
        });

        it("should parse via candidates on an event link", () => {
            expect(
                peramlinkConstructor.parsePermalink(
                    "matrix:roomid/somewhere:example.org/e/something:example.com?via=one.org&via=two.org",
                ),
            ).toEqual(
                new PermalinkParts("!somewhere:example.org", "$something:example.com", null, ["one.org", "two.org"]),
            );
        });

        it("should round-trip a room-ID link with via candidates through forRoom", () => {
            const link = peramlinkConstructor.forRoom("!somewhere:example.org", ["one.org", "two.org"]);
            expect(peramlinkConstructor.parsePermalink(link)).toEqual(
                new PermalinkParts("!somewhere:example.org", null, null, ["one.org", "two.org"]),
            );
        });
    });
});
