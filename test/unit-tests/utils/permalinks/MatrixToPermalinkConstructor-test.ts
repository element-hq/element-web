/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import MatrixToPermalinkConstructor from "../../../../src/utils/permalinks/MatrixToPermalinkConstructor";
import { PermalinkParts } from "../../../../src/utils/permalinks/PermalinkConstructor";

describe("MatrixToPermalinkConstructor", () => {
    const peramlinkConstructor = new MatrixToPermalinkConstructor();

    describe("parsePermalink", () => {
        it.each([
            ["empty URL", ""],
            ["something that is not an URL", "hello"],
            ["should raise an error for a non-matrix.to URL", "https://example.com/#/@user:example.com"],
        ])("should raise an error for %s", (name: string, url: string) => {
            expect(() => peramlinkConstructor.parsePermalink(url)).toThrow(
                new Error("Does not appear to be a permalink"),
            );
        });

        it.each([
            ["(https)", "https://matrix.to/#/@user:example.com"],
            ["(http)", "http://matrix.to/#/@user:example.com"],
            ["without protocol", "matrix.to/#/@user:example.com"],
        ])("should parse an MXID %s", (name: string, url: string) => {
            expect(peramlinkConstructor.parsePermalink(url)).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });
    });

    describe("forRoom", () => {
        it("constructs a link given a room ID and via servers", () => {
            expect(peramlinkConstructor.forRoom("!myroom:example.com", ["one.example.com", "two.example.com"])).toEqual(
                "https://matrix.to/#/!myroom:example.com?via=one.example.com&via=two.example.com",
            );
        });
    });

    describe("forEvent", () => {
        it("constructs a link given an event ID, room ID and via servers", () => {
            expect(
                peramlinkConstructor.forEvent("!myroom:example.com", "$event4", ["one.example.com", "two.example.com"]),
            ).toEqual("https://matrix.to/#/!myroom:example.com/$event4?via=one.example.com&via=two.example.com");
        });
    });
});
