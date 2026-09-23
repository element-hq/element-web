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
import { HiddenBodyView, type HiddenBodyViewSnapshot } from "./HiddenBodyView";

type HiddenBodyViewProps = HiddenBodyViewSnapshot;

const HiddenBodyViewWrapperImpl = ({
    className,
    ...rest
}: HiddenBodyViewProps & { className?: string }): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <HiddenBodyView vm={vm} className={className} />;
};

const HiddenBodyViewWrapper = withViewDocs(HiddenBodyViewWrapperImpl, HiddenBodyView);

const meta = {
    title: "Timeline/Timeline Body/HiddenBodyView",
    component: HiddenBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        reason: undefined,
    },
} satisfies Meta<typeof HiddenBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithReason: Story = {
    args: {
        reason: "spam",
    },
};
