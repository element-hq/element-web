/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getInitialScreenAfterLogin, init, onNewScreen } from "../../../src/vector/routing";
import type MatrixChat from "../../../src/components/structures/MatrixChat.tsx";

describe("onNewScreen", () => {
    it("should replace history if stripping via fields", () => {
        Object.defineProperty(window, "location", {
            value: {
                hash: "#/room/!room:server?via=abc",
                replace: jest.fn(),
                assign: jest.fn(),
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
                replace: jest.fn(),
                assign: jest.fn(),
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
        jest.spyOn(sessionStorage.__proto__, "getItem").mockClear().mockReturnValue(null);
        jest.spyOn(sessionStorage.__proto__, "setItem").mockClear();
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
            jest.spyOn(sessionStorage.__proto__, "getItem").mockReturnValue(JSON.stringify(screen));
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
            showScreen: jest.fn(),
        } as unknown as MatrixChat;

        init();
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        expect(window.matrixChat.showScreen).toHaveBeenCalledWith("room/!room:server", { via: "abc" });
    });
});
