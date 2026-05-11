/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { MjolnirBodyView, type MjolnirBodyViewActions, type MjolnirBodyViewSnapshot } from "./MjolnirBodyView";

type MjolnirBodyViewProps = MjolnirBodyViewSnapshot &
    MjolnirBodyViewActions & {
        className?: string;
    };

const MjolnirBodyViewWrapperImpl = ({ onAllowClick, className, ...snapshot }: MjolnirBodyViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onAllowClick });

    return <MjolnirBodyView vm={vm} className={className} />;
};

const MjolnirBodyViewWrapper = withViewDocs(MjolnirBodyViewWrapperImpl, MjolnirBodyView);

const meta = {
    title: "Timeline/Timeline Body/MjolnirBodyView",
    component: MjolnirBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        onAllowClick: fn(),
        className: "",
    },
} satisfies Meta<typeof MjolnirBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
