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

import * as stories from "./AgentSettingsView.stories";

const { NotConnected, Connected, Copilot, InvalidCredential, Loading } = composeStories(stories);

describe("<AgentSettingsView />", () => {
    beforeEach(() => {
        for (const action of ["setProvider", "connect", "disconnect", "setModel", "saveInstructions"] as const) {
            vi.mocked(NotConnected.args[action]!).mockClear();
            vi.mocked(Connected.args[action]!).mockClear();
        }
    });

    it("shows a loading state", () => {
        render(<Loading />);
        expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("asks for an Anthropic API key when Claude is not connected", () => {
        render(<NotConnected />);
        expect(screen.getByRole("radio", { name: "Claude" })).toBeChecked();
        expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument();
        expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
    });

    it("asks for a GitHub token when Copilot is selected", () => {
        render(<Copilot />);
        expect(screen.getByRole("radio", { name: "GitHub Copilot" })).toBeChecked();
        expect(screen.getByLabelText("GitHub token")).toBeInTheDocument();
    });

    it("connects with the typed credential", async () => {
        const user = userEvent.setup();
        render(<NotConnected />);

        const connect = screen.getByRole("button", { name: "Connect" });
        expect(connect).toBeDisabled();
        await user.type(screen.getByLabelText("Anthropic API key"), "  sk-ant-test  ");
        await user.click(connect);

        expect(NotConnected.args.connect).toHaveBeenCalledWith("sk-ant-test");
    });

    it("switches the provider", async () => {
        const user = userEvent.setup();
        render(<NotConnected />);

        await user.click(screen.getByRole("radio", { name: "GitHub Copilot" }));

        expect(NotConnected.args.setProvider).toHaveBeenCalledWith("copilot");
    });

    it("shows why the credential was not accepted", () => {
        render(<InvalidCredential />);
        expect(screen.getByText("The key or token was not accepted. Check it and try again.")).toBeInTheDocument();
    });

    it("lets a connected provider be disconnected and its model chosen", async () => {
        const user = userEvent.setup();
        render(<Connected />);

        expect(screen.getByText("Connected to Claude")).toBeInTheDocument();
        expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();

        const model = screen.getByLabelText("Model");
        expect(model).toHaveValue("claude-sonnet-5-5");
        await user.selectOptions(model, "claude-opus-5-5");
        expect(Connected.args.setModel).toHaveBeenCalledWith("claude-opus-5-5");

        await user.click(screen.getByRole("button", { name: "Disconnect" }));
        expect(Connected.args.disconnect).toHaveBeenCalled();
    });

    it("saves changed instructions", async () => {
        const user = userEvent.setup();
        render(<Connected />);

        const save = screen.getByRole("button", { name: "Save" });
        expect(save).toBeDisabled();
        const instructions = screen.getByLabelText("Instructions");
        await user.clear(instructions);
        await user.type(instructions, "Be brief.");
        await user.click(save);

        expect(Connected.args.saveInstructions).toHaveBeenCalledWith("Be brief.");
    });
});
