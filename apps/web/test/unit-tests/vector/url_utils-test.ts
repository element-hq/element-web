/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { parseQsFromFragment, searchParamsToQueryDict } from "../../../src/vector/url_utils";

describe("url_utils.ts", function () {
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
});
