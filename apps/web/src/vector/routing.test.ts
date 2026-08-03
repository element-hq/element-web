/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

import { getInitialScreenAfterLogin, getScreenFromLocation, init, onNewScreen } from "./routing";
import type MatrixChat from "../components/structures/MatrixChat.tsx";

describe("onNewScreen", () => {
    it("should replace history if stripping via fields", () => {
        Object.defineProperty(window, "location", {
            value: {
                hash: "#/room/!room:server?via=abc",
                replace: vi.fn(),
                assign: vi.fn(),
            },
            writable: true,
        });
        onNewScreen("room/!room:server");
        expect(window.location.assign).not.toHaveBeenCalled();
        expect(window.location.replace).toHaveBeenCalled();
    });

    it("should not replace history if changing rooms", () => {
        Object.defineProperty(window, "location", {
            value: {
                hash: "#/room/!room1:server?via=abc",
                replace: vi.fn(),
                assign: vi.fn(),
            },
            writable: true,
        });
        onNewScreen("room/!room2:server");
        expect(window.location.assign).toHaveBeenCalled();
        expect(window.location.replace).not.toHaveBeenCalled();
    });
});

describe("getInitialScreenAfterLogin", () => {
    beforeEach(() => {
        vi.spyOn(sessionStorage, "getItem").mockClear().mockReturnValue(null);
        vi.spyOn(sessionStorage, "setItem").mockClear();
    });

    const makeMockLocation = (hash = "") => {
        const url = new URL("https://test.org");
        url.hash = hash;
        return url as unknown as Location;
    };

    describe("when current url has no hash", () => {
        it("does not set an initial screen in session storage", () => {
            getInitialScreenAfterLogin(makeMockLocation());
            expect(sessionStorage.setItem).not.toHaveBeenCalled();
        });

        it("returns undefined when there is no initial screen in session storage", () => {
            expect(getInitialScreenAfterLogin(makeMockLocation())).toBeUndefined();
        });

        it("returns initial screen from session storage", () => {
            const screen = {
                screen: "/room/!test",
            };
            vi.spyOn(sessionStorage, "getItem").mockReturnValue(JSON.stringify(screen));
            expect(getInitialScreenAfterLogin(makeMockLocation())).toEqual(screen);
        });
    });

    describe("when current url has a hash", () => {
        it("sets an initial screen in session storage", () => {
            const hash = "/room/!test";
            getInitialScreenAfterLogin(makeMockLocation(hash));
            expect(sessionStorage.setItem).toHaveBeenCalledWith(
                "mx_screen_after_login",
                JSON.stringify({
                    screen: "room/!test",
                    params: {},
                }),
            );
        });

        it("sets an initial screen in session storage with params", () => {
            const hash = "/room/!test?param=test";
            getInitialScreenAfterLogin(makeMockLocation(hash));
            expect(sessionStorage.setItem).toHaveBeenCalledWith(
                "mx_screen_after_login",
                JSON.stringify({
                    screen: "room/!test",
                    params: { param: "test" },
                }),
            );
        });
    });
});

describe("init", () => {
    afterAll(() => {
        // @ts-ignore
        delete window.matrixChat;
    });

    it("should call showScreen on MatrixChat on hashchange", () => {
        Object.defineProperty(window, "location", {
            value: {
                hash: "#/room/!room:server?via=abc",
            },
        });

        window.matrixChat = {
            showScreen: vi.fn(),
        } as unknown as MatrixChat;

        init();
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        expect(window.matrixChat.showScreen).toHaveBeenCalledWith("room/!room:server", { via: "abc" });
    });

    it("should translate a raw matrix: URI hash and call showScreen with the translated screen", () => {
        Object.defineProperty(window, "location", {
            value: {
                hash: "#matrix:u/hookshot:beefy",
            },
        });

        window.matrixChat = {
            showScreen: vi.fn(),
        } as unknown as MatrixChat;

        init();
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        expect(window.matrixChat.showScreen).toHaveBeenCalledWith("user/@hookshot:beefy", {});
    });
});

describe("getScreenFromLocation", () => {
    const makeMockLocation = (hash: string) => {
        const url = new URL("https://test.org");
        url.hash = hash;
        return url as unknown as Location;
    };

    it("translates a matrix: user URI", () => {
        expect(getScreenFromLocation(makeMockLocation("#matrix:u/hookshot:beefy"))).toEqual({
            screen: "user/@hookshot:beefy",
            params: {},
        });
    });

    it("translates a matrix: room alias URI", () => {
        expect(getScreenFromLocation(makeMockLocation("#matrix:r/room:example.org"))).toEqual({
            screen: "room/#room:example.org",
            params: {},
        });
    });

    it("translates a matrix: room-ID + event URI, preserving via params separately", () => {
        expect(
            getScreenFromLocation(
                makeMockLocation("#matrix:roomid/somewhere:example.org/e/something:example.com?via=one.org"),
            ),
        ).toEqual({
            screen: "room/!somewhere:example.org/$something:example.com",
            params: { via: "one.org" },
        });
    });

    it("passes an already-internal hash through unchanged", () => {
        expect(getScreenFromLocation(makeMockLocation("#/room/!room:server"))).toEqual({
            screen: "room/!room:server",
            params: {},
        });
    });

    it("does not mangle an OAuth-style fragment", () => {
        expect(getScreenFromLocation(makeMockLocation("#code=abc123&state=xyz"))).toEqual({
            screen: "",
            params: { code: "abc123", state: "xyz" },
        });
    });

    it("leaves a non-permalink, non-internal hash unchanged without throwing", () => {
        expect(getScreenFromLocation(makeMockLocation("#foobar"))).toEqual({
            screen: "oobar",
            params: {},
        });
    });
});
