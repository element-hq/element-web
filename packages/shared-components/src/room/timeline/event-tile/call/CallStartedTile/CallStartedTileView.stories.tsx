/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { CallStartedTileView, type CallStartedTileViewSnapshot, CallType } from "./CallStartedTileView";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";

const CallStartedTileViewWrapperImpl = ({ ...rest }: CallStartedTileViewSnapshot): React.ReactNode => {
    const vm = useMockedViewModel(rest, {});
    return <CallStartedTileView vm={vm} />;
};

const CallStartedTileViewWrapper = withViewDocs(CallStartedTileViewWrapperImpl, CallStartedTileView);

const meta = {
    title: "Event/Calls/CallStartedTileView",
    component: CallStartedTileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        type: {
            options: [CallType.Video, CallType.Voice],
            control: { type: "select" },
        },
        timestamp: {
            control: { type: "text" },
        },
    },
    args: {
        type: CallType.Voice,
        timestamp: "12:36",
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11217-3901&t=OvT1LOc5wH4kXt0a-4",
        },
    },
} satisfies Meta<typeof CallStartedTileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VoiceCall: Story = {
    args: {
        type: CallType.Voice,
    },
};

export const VideoCall: Story = {
    args: {
        type: CallType.Video,
    },
};
