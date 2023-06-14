/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import MatrixToPermalinkConstructor from "../../../src/utils/permalinks/MatrixToPermalinkConstructor";
import { PermalinkParts } from "../../../src/utils/permalinks/PermalinkConstructor";

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
