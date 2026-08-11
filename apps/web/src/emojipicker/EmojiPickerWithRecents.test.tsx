/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import { EmojiPickerWithRecents } from "./EmojiPickerWithRecents";
import { getKeyBindingsManager } from "../KeyBindingsManager";

describe("EmojiPickerWithRecents", () => {
    it("passes the selected emoji through to the picker", () => {
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} selectedEmojis={new Set(["🎉"])} />);

        expect(screen.getByRole("checkbox", { name: "🎉" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("checkbox", { name: "🚀" })).toHaveAttribute("aria-checked", "false");
    });

    it("resolves keyboard actions using the app's keybindings", async () => {
        const getAccessibilityAction = vi.spyOn(getKeyBindingsManager(), "getAccessibilityAction");
        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        screen.getByRole("button", { name: "🎉" }).focus();
        await userEvent.keyboard("[ArrowRight]");

        expect(getAccessibilityAction).toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "😕" })).toHaveFocus();
    });
});
