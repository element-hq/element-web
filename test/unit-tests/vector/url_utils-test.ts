/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { parseQsFromFragment, parseQs } from "../../../src/vector/url_utils";

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
            params: {
                foo: "bar",
            },
        });
    });

    it("parseQs", function () {
        location.search = "?foo=bar";
        expect(parseQs(location)).toEqual({
            foo: "bar",
        });
    });

    it("parseQs with arrays", function () {
        location.search = "?via=s1&via=s2&via=s2&foo=bar";
        expect(parseQs(location)).toEqual({
            via: ["s1", "s2", "s2"],
            foo: "bar",
        });
    });
});
