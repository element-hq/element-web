/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it } from "vitest";

import { consumeDisplayMediaCallback, setDisplayMediaCallback } from "./displayMediaCallback.js";

describe("displayMediaCallback", () => {
    beforeEach(() => {
        // Reset the module-level slot between tests.
        setDisplayMediaCallback(null);
    });

    it("starts empty", () => {
        expect(consumeDisplayMediaCallback()).toBeNull();
    });

    it("returns the stored callback once, then clears it (consume-once)", () => {
        const callback = (): void => {};
        setDisplayMediaCallback(callback);

        expect(consumeDisplayMediaCallback()).toBe(callback);
        // A second consume (duplicate/stale IPC) yields null rather than re-invoking the callback.
        expect(consumeDisplayMediaCallback()).toBeNull();
    });

    it("setDisplayMediaCallback(null) clears a pending callback", () => {
        setDisplayMediaCallback((): void => {});
        setDisplayMediaCallback(null);

        expect(consumeDisplayMediaCallback()).toBeNull();
    });
});
