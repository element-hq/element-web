/*
Copyright 2018 New Vector Ltd

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

import QueryMatcher from "../../src/autocomplete/QueryMatcher";

const OBJECTS = [
    { name: "Mel B", nick: "Scary" },
    { name: "Mel C", nick: "Sporty" },
    { name: "Emma", nick: "Baby" },
    { name: "Geri", nick: "Ginger" },
    { name: "Victoria", nick: "Posh" },
];

const NONWORDOBJECTS = [{ name: "B.O.B" }, { name: "bob" }];

describe("QueryMatcher", function () {
    it("Returns results by key", function () {
        const qm = new QueryMatcher(OBJECTS, { keys: ["name"] });
        const results = qm.match("Geri");

        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Geri");
    });

    it("Returns results by prefix", function () {
        const qm = new QueryMatcher(OBJECTS, { keys: ["name"] });
        const results = qm.match("Ge");

        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Geri");
    });

    it("Matches case-insensitive", function () {
        const qm = new QueryMatcher(OBJECTS, { keys: ["name"] });
        const results = qm.match("geri");

        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Geri");
    });

    it("Matches ignoring accents", function () {
        const qm = new QueryMatcher([{ name: "Gëri", foo: 46 }], { keys: ["name"] });
        const results = qm.match("geri");

        expect(results.length).toBe(1);
        expect(results[0].foo).toBe(46);
    });

    it("Returns multiple results in order of search string appearance", function () {
        const qm = new QueryMatcher(OBJECTS, { keys: ["name", "nick"] });
        const results = qm.match("or");

        expect(results.length).toBe(2);
        expect(results[0].name).toBe("Mel C");
        expect(results[1].name).toBe("Victoria");

        qm.setObjects(OBJECTS.slice().reverse());
        const reverseResults = qm.match("or");

        // should still be in the same order: search string position
        // takes precedence over input order
        expect(reverseResults.length).toBe(2);
        expect(reverseResults[0].name).toBe("Mel C");
        expect(reverseResults[1].name).toBe("Victoria");
    });

    it("Returns results with search string in same place according to key index", function () {
        const objects = [
            { name: "a", first: "hit", second: "miss", third: "miss" },
            { name: "b", first: "miss", second: "hit", third: "miss" },
            { name: "c", first: "miss", second: "miss", third: "hit" },
        ];
        const qm = new QueryMatcher(objects, { keys: ["second", "first", "third"] });
        const results = qm.match("hit");

        expect(results.length).toBe(3);
        expect(results[0].name).toBe("b");
        expect(results[1].name).toBe("a");
        expect(results[2].name).toBe("c");

        qm.setObjects(objects.slice().reverse());

        const reverseResults = qm.match("hit");

        // should still be in the same order: key index
        // takes precedence over input order
        expect(reverseResults.length).toBe(3);
        expect(reverseResults[0].name).toBe("b");
        expect(reverseResults[1].name).toBe("a");
        expect(reverseResults[2].name).toBe("c");
    });

    it("Returns results with search string in same place and key in same place in insertion order", function () {
        const qm = new QueryMatcher(OBJECTS, { keys: ["name"] });
        const results = qm.match("Mel");

        expect(results.length).toBe(2);
        expect(results[0].name).toBe("Mel B");
        expect(results[1].name).toBe("Mel C");

        qm.setObjects(OBJECTS.slice().reverse());

        const reverseResults = qm.match("Mel");

        expect(reverseResults.length).toBe(2);
        expect(reverseResults[0].name).toBe("Mel C");
        expect(reverseResults[1].name).toBe("Mel B");
    });

    it("Returns numeric results in correct order (input pos)", function () {
        // regression test for depending on object iteration order
        const qm = new QueryMatcher([{ name: "123456badger" }, { name: "123456" }], { keys: ["name"] });
        const results = qm.match("123456");

        expect(results.length).toBe(2);
        expect(results[0].name).toBe("123456badger");
        expect(results[1].name).toBe("123456");
    });

    it("Returns numeric results in correct order (query pos)", function () {
        const qm = new QueryMatcher([{ name: "999999123456" }, { name: "123456badger" }], { keys: ["name"] });
        const results = qm.match("123456");

        expect(results.length).toBe(2);
        expect(results[0].name).toBe("123456badger");
        expect(results[1].name).toBe("999999123456");
    });

    it("Returns results by function", function () {
        const qm = new QueryMatcher(OBJECTS, {
            keys: ["name"],
            funcs: [(x) => x.name.replace("Mel", "Emma")],
        });

        const results = qm.match("Emma");
        expect(results.length).toBe(3);
        expect(results[0].name).toBe("Emma");
        expect(results[1].name).toBe("Mel B");
        expect(results[2].name).toBe("Mel C");
    });

    it("Matches words only by default", function () {
        const qm = new QueryMatcher(NONWORDOBJECTS, { keys: ["name"] });

        const results = qm.match("bob");
        expect(results.length).toBe(2);
        expect(results[0].name).toBe("B.O.B");
        expect(results[1].name).toBe("bob");
    });

    it("Matches all chars with words-only off", function () {
        const qm = new QueryMatcher(NONWORDOBJECTS, {
            keys: ["name"],
            shouldMatchWordsOnly: false,
        });

        const results = qm.match("bob");
        expect(results.length).toBe(1);
        expect(results[0].name).toBe("bob");
    });
});
