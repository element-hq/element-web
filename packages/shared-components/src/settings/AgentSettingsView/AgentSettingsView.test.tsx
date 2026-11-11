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

const {
    NotConnected,
    Connected,
    Copilot,
    CopilotSignedIn,
    CopilotSigningIn,
    CopilotConnectedWithAccount,
    InvalidCredential,
    Loading,
} = composeStories(stories);

describe("<AgentSettingsView />", () => {
    beforeEach(() => {
        for (const action of [
            "setProvider",
            "connect",
            "connectCopilotAccount",
            "signInCopilot",
            "cancelCopilotSignIn",
            "disconnect",
            "setModel",
            "saveInstructions",
            "setReplySuggestions",
        ] as const) {
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

    it("offers to sign in to GitHub, or a GitHub token, when Copilot is selected", async () => {
        const user = userEvent.setup();
        render(<Copilot />);
        expect(screen.getByRole("radio", { name: "GitHub Copilot" })).toBeChecked();
        expect(screen.getByLabelText("GitHub token")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

        expect(Copilot.args.signInCopilot).toHaveBeenCalled();
    });

    it("offers the GitHub account Copilot is signed in to on this computer", async () => {
        const user = userEvent.setup();
        render(<CopilotSignedIn />);
        expect(screen.getByText("Copilot on this computer is signed in to GitHub as octocat.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Use this account" }));

        expect(CopilotSignedIn.args.connectCopilotAccount).toHaveBeenCalled();
    });

    it("lets the sign-in be cancelled while it continues in the browser", async () => {
        const user = userEvent.setup();
        render(<CopilotSigningIn />);
        expect(screen.getByText("Continue signing in to GitHub in your browser…")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Sign in with GitHub" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(CopilotSigningIn.args.cancelCopilotSignIn).toHaveBeenCalled();
    });

    it("shows the account Copilot is connected with", () => {
        render(<CopilotConnectedWithAccount />);
        expect(screen.getByText("Connected to GitHub Copilot as octocat")).toBeInTheDocument();
        expect(screen.queryByLabelText("GitHub token")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Model")).toBeInTheDocument();
    });

    it("shows an error once below both ways of connecting Copilot", () => {
        render(<Copilot error="unavailable" />);
        expect(
            screen.getAllByText("The provider could not be reached. Check your connection and try again."),
        ).toHaveLength(1);
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

    it("turns the reply suggestions off", async () => {
        const user = userEvent.setup();
        render(<Connected />);

        const toggle = screen.getByRole("switch", { name: "Suggest replies" });
        expect(toggle).toBeChecked();
        await user.click(toggle);

        expect(Connected.args.setReplySuggestions).toHaveBeenCalledWith(false);
    });
});
