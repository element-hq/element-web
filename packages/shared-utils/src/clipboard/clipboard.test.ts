/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { copyPlainTextToClipboard } from "./clipboard";

describe("copyPlainTextToClipboard", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("should copy the text with the clipboard API", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        await expect(copyPlainTextToClipboard("foo")).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("foo");
    });

    it("should fall back to execCommand when the clipboard API is missing", async () => {
        vi.stubGlobal("navigator", {});
        // happy-dom does not implement execCommand, so provide it for this test
        const execCommand = vi.fn().mockReturnValue(true);
        document.execCommand = execCommand;

        try {
            await expect(copyPlainTextToClipboard("foo")).resolves.toBe(true);
            expect(execCommand).toHaveBeenCalledWith("copy");
            // The temporary textarea is removed
            expect(document.querySelector("textarea")).toBeNull();
        } finally {
            // @ts-expect-error -- remove the method added above
            delete document.execCommand;
        }
    });

    it("should return false when copying fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        await expect(copyPlainTextToClipboard("foo")).resolves.toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});
