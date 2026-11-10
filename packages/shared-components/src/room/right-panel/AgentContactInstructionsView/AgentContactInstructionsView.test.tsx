/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, beforeEach, vi } from "vitest";

import * as stories from "./AgentContactInstructionsView.stories";

const { Empty, WithInstructions, Loading, SaveFailed } = composeStories(stories);

describe("<AgentContactInstructionsView />", () => {
    beforeEach(() => {
        vi.mocked(Empty.args.save!).mockClear();
        vi.mocked(WithInstructions.args.save!).mockClear();
    });

    it("shows the saved instructions and where they are kept", () => {
        render(<WithInstructions />);

        expect(screen.getByLabelText("Instructions for the agent")).toHaveValue(
            "# Bob\n\nBob is my manager. Answer formally and use “Sie”.",
        );
        expect(screen.getByText(/@bob%3Aexample\.org\.md/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("saves changed instructions", async () => {
        const user = userEvent.setup();
        render(<Empty />);

        await user.type(screen.getByLabelText("Instructions for the agent"), "Be formal.");
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(Empty.args.save).toHaveBeenCalledWith("Be formal.");
    });

    it("saves cleared instructions as empty", async () => {
        const user = userEvent.setup();
        render(<WithInstructions />);

        await user.clear(screen.getByLabelText("Instructions for the agent"));
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(WithInstructions.args.save).toHaveBeenCalledWith("");
    });

    it("disables the field while loading", () => {
        render(<Loading />);
        expect(screen.getByLabelText("Instructions for the agent")).toBeDisabled();
    });

    it("shows an error when saving failed", () => {
        render(<SaveFailed />);
        expect(screen.getByText("The instructions could not be read or saved. Try again.")).toBeInTheDocument();
    });
});
