/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    AgentContactInstructionsView,
    type AgentContactInstructionsViewActions,
    type AgentContactInstructionsViewSnapshot,
} from "./AgentContactInstructionsView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type AgentContactInstructionsProps = AgentContactInstructionsViewSnapshot & AgentContactInstructionsViewActions;

const AgentContactInstructionsViewWrapperImpl = ({ save, ...rest }: AgentContactInstructionsProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { save });
    return <AgentContactInstructionsView vm={vm} />;
};
const AgentContactInstructionsViewWrapper = withViewDocs(
    AgentContactInstructionsViewWrapperImpl,
    AgentContactInstructionsView,
);

const meta = {
    title: "Room/RightPanel/AgentContactInstructionsView",
    component: AgentContactInstructionsViewWrapper,
    tags: ["autodocs"],
    args: {
        isLoading: false,
        isBusy: false,
        instructions: "",
        filePath: "C:\\Users\\Alice\\AppData\\Local\\Element\\agent\\contacts\\@bob%3Aexample.org.md",
        hasError: false,
        save: fn(),
    },
} satisfies Meta<typeof AgentContactInstructionsViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithInstructions: Story = {
    args: {
        instructions: "# Bob\n\nBob is my manager. Answer formally and use “Sie”.",
    },
};

export const Loading: Story = {
    args: {
        isLoading: true,
        filePath: undefined,
    },
};

export const SaveFailed: Story = {
    args: {
        instructions: "Answer formally.",
        hasError: true,
    },
};
