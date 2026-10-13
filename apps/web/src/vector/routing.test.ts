/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, afterAll, type Mock } from "vitest";

import { getInitialScreenAfterLogin, init, onNewScreen } from "./routing";
import type MatrixChat from "../components/structures/MatrixChat.tsx";

// init() adds a hashchange listener for the copy of the module it is called on, remove them after each test so they
// do not route the hash changes of later tests
const hashChangeListeners: EventListenerOrEventListenerObject[] = [];
beforeEach(() => {
    const addEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type: string, listener: any, options?: any) => {
        if (type === "hashchange") hashChangeListeners.push(listener);
        addEventListener(type, listener, options);
    });
});

afterEach(() => {
    hashChangeListeners.splice(0).forEach((listener) => window.removeEventListener("hashchange", listener));
    vi.restoreAllMocks();
});

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
});

describe("hash changes", () => {
    /**
     * Handles fragment navigation the way a browser does: the hash is percent-encoded by the URL parser, nothing
     * happens if it is unchanged, and the hashchange event is queued rather than fired synchronously.
     */
    class FakeBrowser {
        private static readonly ORIGIN = "https://test.org/";
        private hash = "";
        private queue: HashChangeEvent[] = [];

        public readonly location = {
            hash: "",
            href: FakeBrowser.ORIGIN,
            assign: vi.fn((hash: string) => this.navigate(hash)),
            replace: vi.fn((hash: string) => this.navigate(hash)),
        };

        public navigate(hash: string): void {
            const newHash = new URL(hash, FakeBrowser.ORIGIN).hash;
            if (newHash === this.hash) return;
            const oldURL = this.location.href;
            this.hash = this.location.hash = newHash;
            this.location.href = FakeBrowser.ORIGIN + newHash;
            this.queue.push(new HashChangeEvent("hashchange", { oldURL, newURL: this.location.href }));
        }

        /** Fire the queued hashchange events. */
        public flush(): void {
            const queue = this.queue;
            this.queue = [];
            queue.forEach((ev) => window.dispatchEvent(ev));
        }
    }

    let browser: FakeBrowser;
    let routing: typeof import("./routing");
    let showScreen: Mock<MatrixChat["showScreen"]>;
    const errors: unknown[] = [];
    const onError = (ev: ErrorEvent): void => {
        errors.push(ev.error);
    };

    beforeEach(async () => {
        browser = new FakeBrowser();
        Object.defineProperty(window, "location", { value: browser.location, writable: true });
        showScreen = vi.fn();
        window.matrixChat = { showScreen } as unknown as MatrixChat;
        window.addEventListener("error", onError);

        vi.resetModules();
        routing = await import("./routing");
        routing.init();
    });

    afterEach(() => {
        errors.splice(0);
        window.removeEventListener("error", onError);
        // @ts-ignore
        delete window.matrixChat;
    });

    const shownScreens = (): string[] => showScreen.mock.calls.map(([screen]) => screen);

    it("routes a navigation whose hashchange event fires after we set the hash ourselves", () => {
        browser.navigate("#/room/!b:s/$event");
        routing.onNewScreen("room/!a:s");
        browser.flush();
        expect(shownScreens()).toEqual(["room/!b:s/$event"]);
    });

    it("does not route hashes we set ourselves, even if we set several before their events fire", () => {
        routing.onNewScreen("room/!a:s");
        routing.onNewScreen("room/!b:s");
        browser.flush();
        expect(shownScreens()).toEqual([]);
    });

    it.each(["room/#ü:s", "user/@a b:s"])(
        "does not route %s which we set ourselves and the browser encodes",
        (screen) => {
            routing.onNewScreen(screen);
            browser.flush();
            expect(shownScreens()).toEqual([]);
        },
    );

    it("routes going back to our hash from a screen which does not set the hash", () => {
        routing.onNewScreen("room/!a:s");
        browser.flush();
        browser.navigate("#/directory");
        browser.flush();
        browser.navigate("#/room/!a:s");
        browser.flush();
        expect(shownScreens()).toEqual(["directory", "room/!a:s"]);
    });

    it("routes going back to a hash which we set without changing it", () => {
        browser.navigate("#/room/!a:s");
        browser.flush();
        routing.onNewScreen("room/!a:s");
        browser.navigate("#/room/!b:s");
        browser.flush();
        routing.onNewScreen("room/!b:s");
        browser.navigate("#/room/!a:s");
        browser.flush();
        expect(shownScreens()).toEqual(["room/!a:s", "room/!b:s", "room/!a:s"]);
    });

    it("routes a hash with a malformed percent-encoding", () => {
        browser.navigate("#/room/%E0%A4%A");
        browser.flush();
        expect(errors).toEqual([]);
        expect(shownScreens()).toEqual(["room/%E0%A4%A"]);
    });

    it("replaces history when stripping via from a room alias", () => {
        browser.navigate("#/room/#ü:s?via=s");
        routing.onNewScreen("room/#ü:s");
        expect(browser.location.replace).toHaveBeenCalled();
        expect(browser.location.assign).not.toHaveBeenCalled();
    });

    it("adds to history when going to a room alias which the current one starts with", () => {
        browser.navigate("#/room/#a:s.org");
        routing.onNewScreen("room/#a:s");
        expect(browser.location.assign).toHaveBeenCalled();
        expect(browser.location.replace).not.toHaveBeenCalled();
    });
});
