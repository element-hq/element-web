/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ensureServiceWorkerControl } from "./serviceWorkerControl";

/** Matches CLAIM_TIMEOUT_MS in the module under test. */
const CLAIM_TIMEOUT_MS = 2000;

describe("ensureServiceWorkerControl", () => {
    let listeners: Array<() => void>;
    let container: { controller: object | null };
    let postMessage: ReturnType<typeof vi.fn>;
    let reload: ReturnType<typeof vi.fn>;

    /** Fire the listeners registered for "controllerchange". */
    const fireControllerChange = (): void => listeners.forEach((l) => l());

    /** A registration whose active worker is present unless `active` is false. */
    const registration = (active = true): ServiceWorkerRegistration =>
        ({ active: active ? { postMessage } : null }) as unknown as ServiceWorkerRegistration;

    beforeEach(() => {
        vi.useFakeTimers();
        listeners = [];
        postMessage = vi.fn();
        container = { controller: null };

        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            configurable: true,
            value: {
                get controller() {
                    return container.controller;
                },
                addEventListener: (type: string, listener: () => void) => {
                    if (type === "controllerchange") listeners.push(listener);
                },
                removeEventListener: (type: string, listener: () => void) => {
                    if (type === "controllerchange") listeners = listeners.filter((l) => l !== listener);
                },
            },
        });

        reload = vi.fn();
        Object.defineProperty(window.location, "reload", { configurable: true, value: reload });

        window.sessionStorage.clear();
        window.location.hash = "";
    });

    afterEach(() => {
        Reflect.deleteProperty(globalThis.navigator, "serviceWorker");
        window.sessionStorage.clear();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("does nothing when a worker already controls the page", async () => {
        container.controller = {};

        await ensureServiceWorkerControl(registration());

        expect(postMessage).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it("clears an earlier reload marker once controlled, so a later hard reload can try again", async () => {
        window.sessionStorage.setItem("mx_sw_control_reload", "1");
        container.controller = {};

        await ensureServiceWorkerControl(registration());

        expect(window.sessionStorage.getItem("mx_sw_control_reload")).toBeNull();
    });

    it("asks the active worker to adopt the page, and does not reload when it does", async () => {
        postMessage.mockImplementation(() => {
            container.controller = {};
            fireControllerChange();
        });

        await ensureServiceWorkerControl(registration());

        expect(postMessage).toHaveBeenCalledWith({ type: "claimClients" });
        // Control regained without a navigation, which is the whole point of asking.
        expect(reload).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem("mx_sw_control_reload")).toBeNull();
    });

    it("reloads once when the worker does not adopt the page", async () => {
        const promise = ensureServiceWorkerControl(registration());
        await vi.advanceTimersByTimeAsync(CLAIM_TIMEOUT_MS);
        await promise;

        // A normal navigation is controlled by the active worker, which is why an
        // ordinary reload is the workaround users cannot be expected to discover.
        expect(reload).toHaveBeenCalledOnce();
        expect(window.sessionStorage.getItem("mx_sw_control_reload")).toBe("1");
    });

    it("does not reload a second time if the first one did not help", async () => {
        window.sessionStorage.setItem("mx_sw_control_reload", "1");

        const promise = ensureServiceWorkerControl(registration());
        await vi.advanceTimersByTimeAsync(CLAIM_TIMEOUT_MS);
        await promise;

        expect(reload).not.toHaveBeenCalled();
    });

    it("does not reload when the URL carries a credential a reload would re-submit", async () => {
        // An OAuth2 authorization code is consumed once; requesting the URL again fails.
        window.location.hash = "#code=abc&state=def";

        const promise = ensureServiceWorkerControl(registration());
        await vi.advanceTimersByTimeAsync(CLAIM_TIMEOUT_MS);
        await promise;

        expect(reload).not.toHaveBeenCalled();
    });

    it("does nothing when there is no active worker to ask", async () => {
        // Still installing: its own activate handler will claim this page when it lands.
        await ensureServiceWorkerControl(registration(false));

        expect(postMessage).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });
});
