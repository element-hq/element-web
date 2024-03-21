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

import { abbreviateUrl, parseUrl, unabbreviateUrl } from "../../src/utils/UrlUtils";

describe("abbreviateUrl", () => {
    it("should return empty string if passed falsey", () => {
        expect(abbreviateUrl(undefined)).toEqual("");
    });

    it("should abbreviate to host if empty pathname", () => {
        expect(abbreviateUrl("https://foo/")).toEqual("foo");
    });

    it("should not abbreviate if has path parts", () => {
        expect(abbreviateUrl("https://foo/path/parts")).toEqual("https://foo/path/parts");
    });
});

describe("unabbreviateUrl", () => {
    it("should return empty string if passed falsey", () => {
        expect(unabbreviateUrl(undefined)).toEqual("");
    });

    it("should prepend https to input if it lacks it", () => {
        expect(unabbreviateUrl("element.io")).toEqual("https://element.io");
    });

    it("should not prepend https to input if it has it", () => {
        expect(unabbreviateUrl("https://element.io")).toEqual("https://element.io");
    });
});

describe("parseUrl", () => {
    it("should not throw on no proto", () => {
        expect(() => parseUrl("test")).not.toThrow();
    });
});
