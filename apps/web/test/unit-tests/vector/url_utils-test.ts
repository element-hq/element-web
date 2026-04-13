/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { parseAppUrl, parseQsFromFragment, searchParamsToQueryDict } from "../../../src/vector/url_utils";

// @ts-ignore
const location: Location = {
    hash: "",
    search: "",
};

it("parseQsFromFragment", function () {
    location.hash = "/home?foo=bar";
    expect(parseQsFromFragment(location)).toEqual({
        location: "home",
        params: new URLSearchParams({
            foo: "bar",
        }),
    });
});

describe("searchParamsToQueryDict", () => {
    it("should handle arrays correctly", () => {
        const u = new URLSearchParams("a=b&b=c&c=d&a=e&a=f");
        expect(searchParamsToQueryDict(u)).toEqual({
            a: ["b", "e", "f"],
            b: "c",
            c: "d",
        });
    });
});

describe("parseUrlParameters", () => {
    it("should parse oidc parameters", () => {
        const u = new URL("https://app.element.io?code=foobar&state=barfoo");
        const parsed = parseAppUrl(u);
        expect(parsed.params.oidc?.code).toEqual("foobar");
        expect(parsed.params.oidc?.state).toEqual("barfoo");
    });

    it("should parse guest parameters", () => {
        const u = new URL("https://app.element.io?foo=bar#/room/!roomId:server?guest_access_token=foobar");
        const parsed = parseAppUrl(u);
        expect(parsed.params.guest?.guest_access_token).toEqual("foobar");
    });
});
