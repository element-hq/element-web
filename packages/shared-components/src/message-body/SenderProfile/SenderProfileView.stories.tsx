/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import { SenderProfileView, type SenderProfileViewActions, type SenderProfileViewSnapshot } from "./SenderProfileView";

type SenderProfileProps = SenderProfileViewSnapshot & SenderProfileViewActions;

const SenderProfileViewWrapper = ({ onClick, ...rest }: SenderProfileProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick });
    return <SenderProfileView vm={vm} />;
};

export default {
    title: "MessageBody/SenderProfile",
    component: SenderProfileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        isVisible: { control: "boolean" },
        displayName: { control: "text" },
        displayIdentifier: { control: "text" },
        colorClass: { control: "text" },
        className: { control: "text" },
        title: { control: "text" },
        emphasizeDisplayName: { control: "boolean" },
    },
    args: {
        isVisible: true,
        displayName: "Alice",
        className: "mx_DisambiguatedProfile",
        emphasizeDisplayName: true,
        onClick: fn(),
    },
} as Meta<typeof SenderProfileViewWrapper>;

const Template: StoryFn<typeof SenderProfileViewWrapper> = (args) => <SenderProfileViewWrapper {...args} />;

export const Default = Template.bind({});

export const Hidden = Template.bind({});
Hidden.args = {
    isVisible: false,
};

export const WithDisambiguation = Template.bind({});
WithDisambiguation.args = {
    displayName: "Alice",
    displayIdentifier: "@alice:example.org",
};
