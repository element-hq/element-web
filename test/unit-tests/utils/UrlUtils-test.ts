/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { abbreviateUrl, parseUrl, unabbreviateUrl } from "../../../src/utils/UrlUtils";

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
