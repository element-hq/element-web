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
});
