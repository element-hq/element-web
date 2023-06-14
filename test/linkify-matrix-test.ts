/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { linkify, Type } from "../src/linkify-matrix";

describe("linkify-matrix", () => {
    const linkTypesByInitialCharacter: Record<string, string> = {
        "#": "roomalias",
        "@": "userid",
    };

    /**
     *
     * @param testName Due to all the tests using the same logic underneath, it makes to generate it in a bit smarter way
     * @param char
     */
    function genTests(char: "#" | "@" | "+") {
        const type = linkTypesByInitialCharacter[char];
        it("should not parse " + char + "foo without domain", () => {
            const test = char + "foo";
            const found = linkify.find(test);
            expect(found).toEqual([]);
        });
        describe("ip v4 tests", () => {
            it("should properly parse IPs v4 as the domain name", () => {
                const test = char + "potato:1.2.3.4";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "potato:1.2.3.4",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length,
                        value: char + "potato:1.2.3.4",
                    },
                ]);
            });
            it("should properly parse IPs v4 with port as the domain name with attached", () => {
                const test = char + "potato:1.2.3.4:1337";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "potato:1.2.3.4:1337",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length,
                        value: char + "potato:1.2.3.4:1337",
                    },
                ]);
            });
            it("should properly parse IPs v4 as the domain name while ignoring missing port", () => {
                const test = char + "potato:1.2.3.4:";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "potato:1.2.3.4",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length - 1,
                        value: char + "potato:1.2.3.4",
                    },
                ]);
            });
        });
        // Currently those tests are failing, as there's missing implementation.
        describe.skip("ip v6 tests", () => {
            it("should properly parse IPs v6 as the domain name", () => {
                const test = char + "username:[1234:5678::abcd]";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "username:[1234:5678::abcd]",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length,
                        value: char + "username:[1234:5678::abcd]",
                    },
                ]);
            });

            it("should properly parse IPs v6 with port as the domain name", () => {
                const test = char + "username:[1234:5678::abcd]:1337";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "username:[1234:5678::abcd]:1337",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length,
                        value: char + "username:[1234:5678::abcd]:1337",
                    },
                ]);
            });
            // eslint-disable-next-line max-len
            it("should properly parse IPs v6 while ignoring dangling comma when without port name as the domain name", () => {
                const test = char + "username:[1234:5678::abcd]:";
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: char + "username:[1234:5678::abcd]:",
                        type,
                        isLink: true,
                        start: 0,
                        end: test.length - 1,
                        value: char + "username:[1234:5678::abcd]:",
                    },
                ]);
            });
        });
        it("properly parses " + char + "_foonetic_xkcd:matrix.org", () => {
            const test = "" + char + "_foonetic_xkcd:matrix.org";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "_foonetic_xkcd:matrix.org",
                    type,
                    value: char + "_foonetic_xkcd:matrix.org",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("properly parses " + char + "foo:localhost", () => {
            const test = char + "foo:localhost";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:localhost",
                    type,
                    value: char + "foo:localhost",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("accept " + char + "foo:bar.com", () => {
            const test = "" + char + "foo:bar.com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.com",
                    type,
                    value: char + "foo:bar.com",
                    start: 0,
                    end: test.length,

                    isLink: true,
                },
            ]);
        });
        it("accept " + char + "foo:com (mostly for (TLD|DOMAIN)+ mixing)", () => {
            const test = "" + char + "foo:com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:com",
                    type,
                    value: char + "foo:com",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("accept repeated TLDs (e.g .org.uk)", () => {
            const test = "" + char + "foo:bar.org.uk";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.org.uk",
                    type,
                    value: char + "foo:bar.org.uk",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("accept hyphens in name " + char + "foo-bar:server.com", () => {
            const test = "" + char + "foo-bar:server.com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo-bar:server.com",
                    type,
                    value: char + "foo-bar:server.com",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("ignores trailing `:`", () => {
            const test = "" + char + "foo:bar.com:";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    type,
                    value: char + "foo:bar.com",
                    href: char + "foo:bar.com",
                    start: 0,
                    end: test.length - ":".length,

                    isLink: true,
                },
            ]);
        });
        it("accept :NUM (port specifier)", () => {
            const test = "" + char + "foo:bar.com:2225";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.com:2225",
                    type,
                    value: char + "foo:bar.com:2225",
                    start: 0,
                    end: test.length,
                    isLink: true,
                },
            ]);
        });
        it("ignores all the trailing :", () => {
            const test = "" + char + "foo:bar.com::::";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.com",
                    type,
                    value: char + "foo:bar.com",
                    end: test.length - 4,
                    start: 0,
                    isLink: true,
                },
            ]);
        });
        it("properly parses room alias with dots in name", () => {
            const test = "" + char + "foo.asdf:bar.com::::";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo.asdf:bar.com",
                    type,
                    value: char + "foo.asdf:bar.com",
                    start: 0,
                    end: test.length - ":".repeat(4).length,

                    isLink: true,
                },
            ]);
        });
        it("does not parse room alias with too many separators", () => {
            const test = "" + char + "foo:::bar.com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: "http://bar.com",
                    type: "url",
                    value: "bar.com",
                    isLink: true,
                    start: 7,
                    end: test.length,
                },
            ]);
        });
        it("does not parse multiple room aliases in one string", () => {
            const test = "" + char + "foo:bar.com-baz.com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.com-baz.com",
                    type,
                    value: char + "foo:bar.com-baz.com",
                    end: 20,
                    start: 0,
                    isLink: true,
                },
            ]);
        });
    }

    describe("roomalias plugin", () => {
        genTests("#");
    });

    describe("userid plugin", () => {
        genTests("@");

        it("allows dots in localparts", () => {
            const test = "@test.:matrix.org";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: test,
                    type: "userid",
                    value: test,
                    start: 0,
                    end: test.length,

                    isLink: true,
                },
            ]);
        });
    });

    describe("matrix uri", () => {
        const acceptedMatrixUris = [
            "matrix:u/foo_bar:server.uk",
            "matrix:r/foo-bar:server.uk",
            "matrix:roomid/somewhere:example.org?via=elsewhere.ca",
            "matrix:r/somewhere:example.org",
            "matrix:r/somewhere:example.org/e/event",
            "matrix:roomid/somewhere:example.org/e/event?via=elsewhere.ca",
            "matrix:u/alice:example.org?action=chat",
        ];
        for (const matrixUri of acceptedMatrixUris) {
            it("accepts " + matrixUri, () => {
                const test = matrixUri;
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: matrixUri,
                        type: Type.URL,
                        value: matrixUri,
                        end: matrixUri.length,
                        start: 0,
                        isLink: true,
                    },
                ]);
            });
        }
    });

    describe("matrix-prefixed domains", () => {
        const acceptedDomains = ["matrix.org", "matrix.to", "matrix-help.org", "matrix123.org"];
        for (const domain of acceptedDomains) {
            it("accepts " + domain, () => {
                const test = domain;
                const found = linkify.find(test);
                expect(found).toEqual([
                    {
                        href: `http://${domain}`,
                        type: Type.URL,
                        value: domain,
                        end: domain.length,
                        start: 0,
                        isLink: true,
                    },
                ]);
            });
        }
    });
});
