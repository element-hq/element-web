/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { checkSessionLockFree, getSessionLock, SESSION_LOCK_CONSTANTS } from "../../../src/utils/SessionLock";
import { resetJsDomAfterEach } from "../../test-utils";

describe("SessionLock", () => {
    const otherWindows: Array<Window> = [];

    beforeEach(() => {
        jest.useFakeTimers({ now: 1000 });
    });

    afterEach(() => {
        // shut down other windows created by `createWindow`
        otherWindows.forEach((window) => window.close());
        otherWindows.splice(0);
    });

    resetJsDomAfterEach();

    it("A single instance starts up normally", async () => {
        const onNewInstance = jest.fn();
        const result = await getSessionLock(onNewInstance);
        expect(result).toBe(true);
        expect(onNewInstance).not.toHaveBeenCalled();
    });

    it("A second instance starts up normally when the first shut down cleanly", async () => {
        // first instance starts...
        const onNewInstance1 = jest.fn();
        expect(await getSessionLock(onNewInstance1)).toBe(true);
        expect(onNewInstance1).not.toHaveBeenCalled();

        // ... and navigates away
        window.dispatchEvent(new Event("pagehide", {}));

        // second instance starts as normal
        expect(checkSessionLockFree()).toBe(true);
        const onNewInstance2 = jest.fn();
        expect(await getSessionLock(onNewInstance2)).toBe(true);

        expect(onNewInstance1).not.toHaveBeenCalled();
        expect(onNewInstance2).not.toHaveBeenCalled();
    });

    it("A second instance starts up *eventually* when the first terminated uncleanly", async () => {
        // first instance starts...
        const onNewInstance1 = jest.fn();
        expect(await getSessionLock(onNewInstance1)).toBe(true);
        expect(onNewInstance1).not.toHaveBeenCalled();
        expect(checkSessionLockFree()).toBe(false);

        // and pings the timer after 5 seconds
        jest.advanceTimersByTime(5000);
        expect(checkSessionLockFree()).toBe(false);

        // oops, now it dies. We simulate this by forcibly clearing the timers.
        // For some reason `jest.clearAllTimers` also resets the simulated time, so preserve that
        const time = Date.now();
        jest.clearAllTimers();
        jest.setSystemTime(time);
        expect(checkSessionLockFree()).toBe(false);

        // time advances a bit more
        jest.advanceTimersByTime(5000);
        expect(checkSessionLockFree()).toBe(false);

        // second instance tries to start. This should block for 10 more seconds
        const onNewInstance2 = jest.fn();
        let session2Result: boolean | undefined;
        getSessionLock(onNewInstance2).then((res) => {
            session2Result = res;
        });

        // after another 9.5 seconds, we are still waiting
        jest.advanceTimersByTime(9500);
        expect(session2Result).toBe(undefined);
        expect(checkSessionLockFree()).toBe(false);

        // another 500ms and we get the lock
        await jest.advanceTimersByTimeAsync(500);
        expect(session2Result).toBe(true);
        expect(checkSessionLockFree()).toBe(false); // still false, because the new session has claimed it

        expect(onNewInstance1).not.toHaveBeenCalled();
        expect(onNewInstance2).not.toHaveBeenCalled();
    });

    it("A second instance starts up when the first terminated uncleanly and the clock was wound back", async () => {
        // first instance starts...
        expect(await getSessionLock(() => Promise.resolve())).toBe(true);
        expect(checkSessionLockFree()).toBe(false);

        // oops, now it dies. We simulate this by forcibly clearing the timers.
        const time = Date.now();
        jest.clearAllTimers();
        expect(checkSessionLockFree()).toBe(false);

        // Now, the clock gets wound back an hour.
        jest.setSystemTime(time - 3600 * 1000);
        expect(checkSessionLockFree()).toBe(false);

        // second instance tries to start. This should block for 15 seconds
        const onNewInstance2 = jest.fn();
        let session2Result: boolean | undefined;
        getSessionLock(onNewInstance2).then((res) => {
            session2Result = res;
        });

        // after another 14.5 seconds, we are still waiting
        jest.advanceTimersByTime(14500);
        expect(session2Result).toBe(undefined);
        expect(checkSessionLockFree()).toBe(false);

        // another 500ms and we get the lock
        await jest.advanceTimersByTimeAsync(500);
        expect(session2Result).toBe(true);
        expect(checkSessionLockFree()).toBe(false); // still false, because the new session has claimed it

        expect(onNewInstance2).not.toHaveBeenCalled();
    });

    it("A second instance waits for the first to shut down", async () => {
        // first instance starts. Once it gets the shutdown signal, it will wait two seconds and then release the lock.
        await getSessionLock(
            () =>
                new Promise<void>((resolve) => {
                    setTimeout(resolve, 2000, 0);
                }),
        );

        // second instance tries to start, but should block
        const { window: window2, getSessionLock: getSessionLock2 } = buildNewContext();
        let session2Result: boolean | undefined;
        getSessionLock2(async () => {}).then((res) => {
            session2Result = res;
        });
        await jest.advanceTimersByTimeAsync(100);
        // should still be blocking
        expect(session2Result).toBe(undefined);

        await jest.advanceTimersByTimeAsync(2000);
        await jest.advanceTimersByTimeAsync(0);

        // session 2 now gets the lock
        expect(session2Result).toBe(true);
        window2.close();
    });

    it("If a third instance starts while we are waiting, we give up immediately", async () => {
        // first instance starts. It will never release the lock.
        await getSessionLock(() => new Promise(() => {}));

        // first instance should ping the timer after 5 seconds
        jest.advanceTimersByTime(5000);

        // second instance starts
        const { getSessionLock: getSessionLock2 } = buildNewContext();
        let session2Result: boolean | undefined;
        const onNewInstance2 = jest.fn();
        getSessionLock2(onNewInstance2).then((res) => {
            session2Result = res;
        });

        await jest.advanceTimersByTimeAsync(100);
        // should still be blocking
        expect(session2Result).toBe(undefined);

        // third instance starts
        const { getSessionLock: getSessionLock3 } = buildNewContext();
        getSessionLock3(async () => {});
        await jest.advanceTimersByTimeAsync(0);

        // session 2 should have given up
        expect(session2Result).toBe(false);
        expect(onNewInstance2).toHaveBeenCalled();
    });

    it("If two new instances start concurrently, only one wins", async () => {
        // first instance starts. Once it gets the shutdown signal, it will wait two seconds and then release the lock.
        await getSessionLock(async () => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 2000, 0);
            });
        });

        // first instance should ping the timer after 5 seconds
        jest.advanceTimersByTime(5000);

        // two new instances start at once
        const { getSessionLock: getSessionLock2 } = buildNewContext();
        let session2Result: boolean | undefined;
        getSessionLock2(async () => {}).then((res) => {
            session2Result = res;
        });

        const { getSessionLock: getSessionLock3 } = buildNewContext();
        let session3Result: boolean | undefined;
        getSessionLock3(async () => {}).then((res) => {
            session3Result = res;
        });

        await jest.advanceTimersByTimeAsync(100);
        // session 3 still be blocking. Session 2 should have given up.
        expect(session2Result).toBe(false);
        expect(session3Result).toBe(undefined);

        await jest.advanceTimersByTimeAsync(2000);
        await jest.advanceTimersByTimeAsync(0);

        // session 3 now gets the lock
        expect(session2Result).toBe(false);
        expect(session3Result).toBe(true);
    });

    /** build a new Window in the same domain as the current one.
     *
     * We do this by constructing an iframe, which gets its own Window object.
     */
    function createWindow() {
        const iframe = window.document.createElement("iframe");
        window.document.body.appendChild(iframe);
        const window2: any = iframe.contentWindow;

        otherWindows.push(window2);

        // make the new Window use the same jest fake timers as us
        for (const m of ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"]) {
            // @ts-ignore
            window2[m] = global[m];
        }
        return window2;
    }

    /**
     * Instantiate `getSessionLock` in a new context (ie, using a different global `window`).
     *
     * The new window will share the same fake timer impl as the current context.
     *
     * @returns the new window and (a wrapper for) getSessionLock in the new context.
     */
    function buildNewContext(): {
        window: Window;
        getSessionLock: (onNewInstance: () => Promise<void>) => Promise<boolean>;
    } {
        const window2 = createWindow();

        // import the dependencies of getSessionLock into the new context
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        window2._uuid = require("uuid");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        window2._logger = require("matrix-js-sdk/src/logger");
        window2.SESSION_LOCK_CONSTANTS = SESSION_LOCK_CONSTANTS;

        // now, define getSessionLock as a global
        window2.eval(String(getSessionLock));

        // return a function that will call it
        function callGetSessionLock(onNewInstance: () => Promise<void>): Promise<boolean> {
            // import the callback into the context
            window2._getSessionLockCallback = onNewInstance;

            // start the function
            try {
                return window2.eval(`getSessionLock(_getSessionLockCallback)`);
            } finally {
                // we can now clear the callback
                delete window2._getSessionLockCallback;
            }
        }

        return { window: window2, getSessionLock: callGetSessionLock };
    }
});
