/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import MatrixToPermalinkConstructor from "./MatrixToPermalinkConstructor";
import { PermalinkParts } from "./PermalinkConstructor";

describe("MatrixToPermalinkConstructor", () => {
    const permalinkConstructor = new MatrixToPermalinkConstructor();

    describe("parsePermalink", () => {
        it.each([
            ["empty URL", ""],
            ["something that is not an URL", "hello"],
            ["should raise an error for a non-matrix.to URL", "https://example.com/#/@user:example.com"],
        ])("should raise an error for %s", (name: string, url: string) => {
            expect(() => permalinkConstructor.parsePermalink(url)).toThrow(
                new Error("Does not appear to be a permalink"),
            );
        });

        it.each([
            ["(https)", "https://matrix.to/#/@user:example.com"],
            ["(http)", "http://matrix.to/#/@user:example.com"],
            ["without protocol", "matrix.to/#/@user:example.com"],
        ])("should parse an MXID %s", (name: string, url: string) => {
            expect(permalinkConstructor.parsePermalink(url)).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });

        it.each([
            ["an action", "?action=chat"],
            ["a custom parameter", "?org.example.key=value"],
        ])("should leave %s out of the MXID", (name: string, query: string) => {
            expect(permalinkConstructor.parsePermalink(`https://matrix.to/#/@user:example.com${query}`)).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });

        it.each([
            ["repeated via servers", "?via=one.example.com&via=two.example.com"],
            ["an action after the via servers", "?via=one.example.com&via=two.example.com&action=join"],
            ["an action before the via servers", "?action=join&via=one.example.com&via=two.example.com"],
            [
                "a custom parameter between via servers",
                "?via=one.example.com&org.example.key=value&via=two.example.com",
            ],
        ])("should read only the via servers from a room link with %s", (name: string, query: string) => {
            expect(permalinkConstructor.parsePermalink(`https://matrix.to/#/!room:example.com${query}`)).toEqual(
                PermalinkParts.forRoom("!room:example.com", ["one.example.com", "two.example.com"]),
            );
        });

        it("should read only the via servers from an event link with other parameters", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "https://matrix.to/#/!room:example.com/$event?via=one.example.com&org.example.key=value",
                ),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "$event", ["one.example.com"]));
        });

        it("should read a room link whose other parameters contain slashes", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "https://matrix.to/#/!room:example.com?via=one.example.com&org.example.url=https://x/y",
                ),
            ).toEqual(PermalinkParts.forRoom("!room:example.com", ["one.example.com"]));
        });

        it("should read an event link whose other parameters contain slashes", () => {
            expect(
                permalinkConstructor.parsePermalink(
                    "https://matrix.to/#/!room:example.com/$event?via=one.example.com&org.example.url=https://x/y",
                ),
            ).toEqual(PermalinkParts.forEvent("!room:example.com", "$event", ["one.example.com"]));
        });
    });

    describe("forRoom", () => {
        it("constructs a link given a room ID and via servers", () => {
            expect(permalinkConstructor.forRoom("!myroom:example.com", ["one.example.com", "two.example.com"])).toEqual(
                "https://matrix.to/#/!myroom:example.com?via=one.example.com&via=two.example.com",
            );
        });
    });

    describe("forEvent", () => {
        it("constructs a link given an event ID, room ID and via servers", () => {
            expect(
                permalinkConstructor.forEvent("!myroom:example.com", "$event4", ["one.example.com", "two.example.com"]),
            ).toEqual("https://matrix.to/#/!myroom:example.com/$event4?via=one.example.com&via=two.example.com");
        });
    });
});
