/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import { EmojiButton } from "./EmojiButton";

describe("<EmojiButton />", () => {
    it("tells assistive technologies that it opens the emoji picker, and whether it is open", async () => {
        render(<EmojiButton addEmoji={vi.fn()} />);
        const button = screen.getByRole("button", { name: "Emoji" });
        expect(button).toHaveAttribute("aria-haspopup", "true");
        expect(button).toHaveAttribute("aria-expanded", "false");

        await userEvent.click(button);
        expect(button).toHaveAttribute("aria-expanded", "true");
    });
});
