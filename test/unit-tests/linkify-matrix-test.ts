/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventListeners } from "linkifyjs";

import { linkify, Type, options } from "../../src/linkify-matrix";
import dispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";

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
        it("properly parses " + char + "localhost:foo.com", () => {
            const test = char + "localhost:foo.com";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "localhost:foo.com",
                    type,
                    value: char + "localhost:foo.com",
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
        it("ignores duplicate :NUM (double port specifier)", () => {
            const test = "" + char + "foo:bar.com:2225:1234";
            const found = linkify.find(test);
            expect(found).toEqual([
                {
                    href: char + "foo:bar.com:2225",
                    type,
                    value: char + "foo:bar.com:2225",
                    start: 0,
                    end: 17,
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
        it("properly parses room alias with hyphen in domain part", () => {
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

        it("should intercept clicks with a ViewRoom dispatch", () => {
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            const handlers = (options.events as (href: string, type: string) => EventListeners)(
                "#room:server.com",
                "roomalias",
            );

            const event = new MouseEvent("mousedown");
            event.preventDefault = jest.fn();
            handlers!.click(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_alias: "#room:server.com",
                }),
            );
        });
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

        it("should intercept clicks with a ViewUser dispatch", () => {
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            const handlers = (options.events as (href: string, type: string) => EventListeners)(
                "@localpart:server.com",
                "userid",
            );

            const event = new MouseEvent("mousedown");
            event.preventDefault = jest.fn();
            handlers!.click(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewUser,
                    member: expect.objectContaining({
                        userId: "@localpart:server.com",
                    }),
                }),
            );
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
