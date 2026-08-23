/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";

import { EmojiPickerWithRecents } from "./EmojiPickerWithRecents";
import * as recent from "./recent";

describe("EmojiPickerWithRecents", () => {
    beforeEach(() => {
        vi.spyOn(recent, "get").mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("uses the first resolvable ordered recent emoji as the persistent Preview fallback", async () => {
        vi.mocked(recent.get).mockReturnValue(["<unsupported>", "🎉", "😀"]);
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        const picker = screen.getByLabelText("Emoji picker");
        await waitFor(() => expect(picker.lastElementChild).toHaveTextContent("🎉"));
        expect(screen.queryByRole("toolbar", { name: "Quick Reactions" })).not.toBeInTheDocument();
    });

    it("uses the grinning face Preview fallback when every recent emoji is unsupported", async () => {
        vi.mocked(recent.get).mockReturnValue(["<unsupported>"]);
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        const picker = screen.getByLabelText("Emoji picker");
        await waitFor(() => expect(picker.lastElementChild).toHaveTextContent("😀"));
        expect(screen.queryByRole("toolbar", { name: "Quick Reactions" })).not.toBeInTheDocument();
    });

    it("uses the grinning face Preview fallback when recents are empty", async () => {
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        const picker = screen.getByLabelText("Emoji picker");
        await waitFor(() => expect(picker.lastElementChild).toHaveTextContent("😀"));
        expect(screen.queryByRole("toolbar", { name: "Quick Reactions" })).not.toBeInTheDocument();
    });

    it("applies the stable Ashram host class and vertical orientation", () => {
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        const picker = screen.getByLabelText("Emoji picker");
        expect(picker).toHaveClass("mx_EmojiPickerWithRecents");
        expect(screen.getByRole("tablist", { name: "Categories" })).toHaveAttribute("aria-orientation", "vertical");
    });
});
