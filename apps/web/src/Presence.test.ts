/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { SetPresence } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { stubClient } from "test-utils";
import Presence from "./Presence";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

describe("Presence", () => {
    let client: MatrixClient;
    let started: Promise<void> | undefined;

    beforeEach(() => {
        Presence.stop();
        vi.useFakeTimers();
        client = stubClient();
        client.setSyncPresence = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(async () => {
        Presence.stop();
        await started;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("sets the initial state to online", () => {
        started = Presence.start();

        expect(Presence.getState()).toBe(SetPresence.Online);
        expect(client.setSyncPresence).toHaveBeenCalledWith(SetPresence.Online);
    });

    it("marks the user unavailable after the inactivity timeout", async () => {
        started = Presence.start();

        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

        expect(Presence.getState()).toBe(SetPresence.Unavailable);
        expect(client.setSyncPresence).toHaveBeenLastCalledWith(SetPresence.Unavailable);
    });

    it("resets state and cancels the inactivity timer when stopped", async () => {
        started = Presence.start();
        Presence.stop();

        expect(Presence.getState()).toBeNull();

        await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
        expect(client.setSyncPresence).toHaveBeenCalledTimes(1);
    });

    it("does not let a stale request roll back a restarted lifecycle", async () => {
        vi.spyOn(logger, "error").mockImplementation(() => {});
        const firstRequest = Promise.withResolvers<void>();
        const secondRequest = Promise.withResolvers<void>();
        client.setSyncPresence = vi
            .fn()
            .mockReturnValueOnce(firstRequest.promise)
            .mockReturnValueOnce(secondRequest.promise);

        const firstStart = Presence.start();
        Presence.stop();
        await firstStart;

        started = Presence.start();
        expect(Presence.getState()).toBe(SetPresence.Online);

        firstRequest.reject(new Error("stale request failed"));
        await vi.advanceTimersByTimeAsync(0);

        expect(Presence.getState()).toBe(SetPresence.Online);

        secondRequest.resolve();
    });
});
