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

describe("parseQsFromFragment", () => {
    it("should parse correctly", () => {
        location.hash = "#/home?foo=bar";
        expect(parseQsFromFragment(location)).toEqual({
            location: "/home",
            params: new URLSearchParams({
                foo: "bar",
            }),
        });
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
    it("should parse legacy sso parameters from query", () => {
        const u = new URL("https://app.element.io?loginToken=foobar");
        const parsed = parseAppUrl(u);
        expect(parsed.params.legacy_sso?.loginToken).toEqual("foobar");
    });

    it("should parse oidc parameters from fragment", () => {
        const u = new URL("https://app.element.io/#code=foobar&state=barfoo");
        const parsed = parseAppUrl(u);
        expect(parsed.params.oidc_fragment?.code).toEqual("foobar");
        expect(parsed.params.oidc_fragment?.state).toEqual("barfoo");
    });

    it("should parse oidc parameters from query", () => {
        const u = new URL("https://app.element.io/?code=foobar&state=barfoo");
        const parsed = parseAppUrl(u);
        expect(parsed.params.oidc_query?.code).toEqual("foobar");
        expect(parsed.params.oidc_query?.state).toEqual("barfoo");
    });

    it("should parse guest parameters", () => {
        const u = new URL("https://app.element.io?foo=bar#/room/!roomId:server?guest_access_token=foobar");
        const parsed = parseAppUrl(u);
        expect(parsed.params.guest?.guest_access_token).toEqual("foobar");
    });
});
