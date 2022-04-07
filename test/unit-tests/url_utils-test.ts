/*
Copyright 2020 New Vector Ltd

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

import { parseQsFromFragment, parseQs } from "../../src/vector/url_utils";

describe("url_utils.ts", function() {
    // @ts-ignore
    const location: Location = {
        hash: "",
        search: "",
    };

    it("parseQsFromFragment", function() {
        location.hash = "/home?foo=bar";
        expect(parseQsFromFragment(location)).toEqual({
            location: "home",
            params: {
                "foo": "bar",
            },
        });
    });

    describe("parseQs", function() {
        location.search = "?foo=bar";
        expect(parseQs(location)).toEqual({
            "foo": "bar",
        });
    });

    describe("parseQs with arrays", function() {
        location.search = "?via=s1&via=s2&via=s2&foo=bar";
        expect(parseQs(location)).toEqual({
            "via": ["s1", "s2", "s2"],
            "foo": "bar",
        });
    });
});
