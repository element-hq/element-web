/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentSettingsView, type AgentSettingsViewActions, type AgentSettingsViewSnapshot } from "./AgentSettingsView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type AgentSettingsProps = AgentSettingsViewSnapshot & AgentSettingsViewActions;

const AgentSettingsViewWrapperImpl = ({
    setProvider,
    connect,
    connectCopilotAccount,
    signInCopilot,
    cancelCopilotSignIn,
    disconnect,
    setModel,
    saveInstructions,
    setReplySuggestions,
    ...rest
}: AgentSettingsProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        setProvider,
        connect,
        connectCopilotAccount,
        signInCopilot,
        cancelCopilotSignIn,
        disconnect,
        setModel,
        saveInstructions,
        setReplySuggestions,
    });
    return <AgentSettingsView vm={vm} />;
};
const AgentSettingsViewWrapper = withViewDocs(AgentSettingsViewWrapperImpl, AgentSettingsView);

const meta = {
    title: "Settings/AgentSettingsView",
    component: AgentSettingsViewWrapper,
    tags: ["autodocs"],
    args: {
        isLoading: false,
        isBusy: false,
        isSigningIn: false,
        provider: "claude",
        connected: { claude: false, copilot: false },
        copilotAuth: undefined,
        copilotAccount: undefined,
        models: [],
        model: undefined,
        instructions: "",
        replySuggestions: true,
        error: undefined,
        setProvider: fn(),
        connect: fn(),
        connectCopilotAccount: fn(),
        signInCopilot: fn(),
        cancelCopilotSignIn: fn(),
        disconnect: fn(),
        setModel: fn(),
        saveInstructions: fn(),
        setReplySuggestions: fn(),
    },
} satisfies Meta<typeof AgentSettingsViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {};

export const Connected: Story = {
    args: {
        connected: { claude: true, copilot: false },
        models: [
            { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
            { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
        ],
        model: "claude-sonnet-5-5",
        instructions: "Answer in a friendly, short way.",
    },
};

export const Copilot: Story = {
    args: {
        provider: "copilot",
        copilotAccount: { signedIn: false },
    },
};

export const CopilotSignedIn: Story = {
    args: {
        provider: "copilot",
        copilotAccount: { signedIn: true, login: "octocat" },
    },
};

export const CopilotSigningIn: Story = {
    args: {
        provider: "copilot",
        isBusy: true,
        isSigningIn: true,
        copilotAccount: { signedIn: false },
    },
};

export const CopilotConnectedWithAccount: Story = {
    args: {
        provider: "copilot",
        connected: { claude: false, copilot: true },
        copilotAuth: "account",
        copilotAccount: { signedIn: true, login: "octocat" },
        models: [
            { id: "gpt-5", name: "GPT-5" },
            { id: "claude-sonnet-5.5", name: "Claude Sonnet 5.5" },
        ],
    },
};

export const InvalidCredential: Story = {
    args: {
        error: "invalid_credential",
    },
};

export const Loading: Story = {
    args: {
        isLoading: true,
    },
};
