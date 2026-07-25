/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { E2eMessageSharedIconView, type E2eMessageSharedIconViewSnapshot } from "./E2eMessageSharedIconView";

type E2eMessageSharedIconProps = E2eMessageSharedIconViewSnapshot & { className?: string };

const E2eMessageSharedIconViewWrapperImpl = ({ className, ...rest }: E2eMessageSharedIconProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <E2eMessageSharedIconView vm={vm} className={className} />;
};
const E2eMessageSharedIconViewWrapper = withViewDocs(E2eMessageSharedIconViewWrapperImpl, E2eMessageSharedIconView);

const meta = {
    title: "Timeline/Timeline Event/E2eMessageSharedIconView",
    component: E2eMessageSharedIconViewWrapper,
    tags: ["autodocs"],
    args: {
        displayName: "Bob",
        userId: "@bob:example.com",
        className: "",
    },
} satisfies Meta<typeof E2eMessageSharedIconViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UnknownUser: Story = {
    tags: ["skip-test"],
    args: {
        displayName: "@bob:example.com",
        userId: "@bob:example.com",
    },
};
