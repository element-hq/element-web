/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@test-utils";

import { CustomStatusView } from "./CustomStatusView";

describe("CustomStatusView", () => {
    it("shows the default emoji and a Cancel link while the text is empty", () => {
        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });

    it("calls onCancel when the link is clicked with empty text", async () => {
        const onCancel = vi.fn();
        const onSave = vi.fn();
        render(<CustomStatusView onCancel={onCancel} onSave={onSave} />);

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("toggles the link to Save and commits the status once text is entered", async () => {
        const onCancel = vi.fn();
        const onSave = vi.fn();
        render(<CustomStatusView onCancel={onCancel} onSave={onSave} />);

        await userEvent.type(screen.getByRole("textbox"), "In a meeting");
        const save = await screen.findByRole("button", { name: "Save" });
        await userEvent.click(save);

        expect(onSave).toHaveBeenCalledWith({ emoji: "😄", text: "In a meeting" });
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("trims whitespace and ignores whitespace-only text", async () => {
        const onCancel = vi.fn();
        const onSave = vi.fn();
        render(<CustomStatusView onCancel={onCancel} onSave={onSave} />);

        await userEvent.type(screen.getByRole("textbox"), "   ");
        // Still a Cancel link, as the trimmed text is empty
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("allows 30 ASCII characters and rejects a 31st", async () => {
        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");

        await userEvent.type(input, "a".repeat(30));
        expect(input).toHaveValue("a".repeat(30));

        await userEvent.type(input, "b");
        expect(input).toHaveValue("a".repeat(30));
    });

    it("counts multi-code-unit emoji as one character each", async () => {
        // 😀 is one visible character but two UTF-16 code units, so native
        // maxLength=30 would stop after 15 of them.
        const grin = "😀";
        expect(grin).toHaveLength(2);

        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");
        await userEvent.click(input);
        await userEvent.paste(grin.repeat(30));

        expect(input).toHaveValue(grin.repeat(30));

        await userEvent.paste(grin);
        expect(input).toHaveValue(grin.repeat(30));
    });

    it("counts a ZWJ family emoji as one character at the 30-character boundary", async () => {
        const family = "👨‍👩‍👧‍👦";
        // This sequence is many UTF-16 code units; native maxLength would split it.
        expect(family.length).toBeGreaterThan(2);

        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");
        await userEvent.click(input);
        await userEvent.paste(`${"a".repeat(29)}${family}`);

        expect(input).toHaveValue(`${"a".repeat(29)}${family}`);

        await userEvent.paste("x");
        expect(input).toHaveValue(`${"a".repeat(29)}${family}`);
    });

    it("truncates a bulk paste to 30 complete graphemes", async () => {
        const family = "👨‍👩‍👧‍👦";
        const pasted = `${"a".repeat(29)}${family}xy`;

        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");
        await userEvent.click(input);
        await userEvent.paste(pasted);

        expect(input).toHaveValue(`${"a".repeat(29)}${family}`);
    });

    it("saves the grapheme-limited text", async () => {
        const onSave = vi.fn();
        const family = "👨‍👩‍👧‍👦";

        render(<CustomStatusView onSave={onSave} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");
        await userEvent.click(input);
        await userEvent.paste(`${"a".repeat(29)}${family}extra`);
        await userEvent.click(await screen.findByRole("button", { name: "Save" }));

        expect(onSave).toHaveBeenCalledWith({ emoji: "😄", text: `${"a".repeat(29)}${family}` });
    });

    it("stops before exceeding the 256-byte protocol cap without splitting a grapheme", async () => {
        const family = "👨‍👩‍👧‍👦";
        // Each family emoji is 25 UTF-8 bytes, so 10 fit in 256 bytes and 11 do not.
        expect(new TextEncoder().encode(family).length).toBe(25);

        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByRole("textbox");
        await userEvent.click(input);
        await userEvent.paste(family.repeat(30));

        expect(input).toHaveValue(family.repeat(10));
        expect(new TextEncoder().encode(family.repeat(10)).length).toBeLessThanOrEqual(256);
        expect(new TextEncoder().encode(family.repeat(11)).length).toBeGreaterThan(256);
    });

    it("lets the user pick an emoji from the picker popover", async () => {
        const onSave = vi.fn();
        render(<CustomStatusView onSave={onSave} onCancel={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: "Choose Emoji" }));
        await waitFor(() => expect(screen.getByLabelText("Emoji picker")).toBeInTheDocument());

        await userEvent.click(await screen.findByText("😇"));

        // Picker closes and the trigger now shows the chosen emoji
        await waitFor(() => expect(screen.queryByTestId("mx_EmojiPicker")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Choose Emoji" })).toHaveTextContent("😇");

        await userEvent.type(screen.getByRole("textbox", { name: "What's your status?" }), "Angelic");
        await userEvent.click(await screen.findByRole("button", { name: "Save" }));

        expect(onSave).toHaveBeenCalledWith({ emoji: "😇", text: "Angelic" });
    });

    it("offers the recently used emoji in the picker", async () => {
        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} recentEmojis={["😇"]} />);

        await userEvent.click(screen.getByRole("button", { name: "Choose Emoji" }));
        await waitFor(() => expect(screen.getByLabelText("Emoji picker")).toBeInTheDocument());

        expect(await screen.findByRole("heading", { name: "Frequently Used" })).toBeInTheDocument();
    });

    it("records the chosen emoji as recently used", async () => {
        const onRecordRecentEmoji = vi.fn();
        render(<CustomStatusView onSave={vi.fn()} onCancel={vi.fn()} onRecordRecentEmoji={onRecordRecentEmoji} />);

        await userEvent.click(screen.getByRole("button", { name: "Choose Emoji" }));
        await waitFor(() => expect(screen.getByLabelText("Emoji picker")).toBeInTheDocument());

        await userEvent.click(await screen.findByText("😇"));

        expect(onRecordRecentEmoji).toHaveBeenCalledWith("😇");
    });
});
