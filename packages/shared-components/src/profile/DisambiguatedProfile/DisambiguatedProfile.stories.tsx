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
    DisambiguatedProfileView,
    type DisambiguatedProfileViewSnapshot,
    type DisambiguatedProfileViewActions,
} from "./DisambiguatedProfileView";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type DisambiguatedProfileProps = DisambiguatedProfileViewSnapshot & DisambiguatedProfileViewActions;

const DisambiguatedProfileViewWrapperImpl = ({
    onClick,
    className,
    ...rest
}: DisambiguatedProfileProps & { className?: string }): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick });
    return <DisambiguatedProfileView vm={vm} className={className} />;
};
const DisambiguatedProfileViewWrapper = withViewDocs(DisambiguatedProfileViewWrapperImpl, DisambiguatedProfileView);

const meta = {
    title: "Profile/DisambiguatedProfile",
    component: DisambiguatedProfileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        displayName: { control: "text" },
        colorClass: { control: "text" },
        className: { control: "text" },
        displayIdentifier: { control: "text" },
        title: { control: "text" },
        emphasizeDisplayName: { control: "boolean" },
    },
    args: {
        displayName: "Alice",
        emphasizeDisplayName: true,
        onClick: fn(),
    },
} satisfies Meta<typeof DisambiguatedProfileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMxid: Story = {
    args: {
        displayName: "Alice",
        displayIdentifier: "@alice:example.org",
        colorClass: "mx_Username_color1",
    },
};

export const WithColorClass: Story = {
    args: {
        displayName: "Bob",
        colorClass: "mx_Username_color3",
    },
};

export const Emphasized: Story = {
    args: {
        displayName: "Charlie",
        emphasizeDisplayName: true,
    },
};

export const WithTooltip: Story = {
    args: {
        displayName: "Diana",
        title: "Diana (@diana:example.org)",
    },
};

export const FullExample: Story = {
    args: {
        displayName: "Eve",
        displayIdentifier: "@eve:matrix.org",
        colorClass: "mx_Username_color5",
        title: "Eve (@eve:matrix.org)",
        emphasizeDisplayName: true,
    },
};
