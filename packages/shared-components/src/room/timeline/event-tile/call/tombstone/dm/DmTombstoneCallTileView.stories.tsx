/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DmTombstoneCallTileView, type DmTombstoneCallTileViewSnapshot } from "./DmTombstoneCallTileView";
import { useMockedViewModel } from "../../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../../.storybook/withViewDocs";
import { CallDirection, CallType } from "../../common";

const RoomTombstoneCallTileViewWrapperImpl = (snapshot: DmTombstoneCallTileViewSnapshot): React.ReactNode => {
    const vm = useMockedViewModel(snapshot, {});
    return <DmTombstoneCallTileView vm={vm} />;
};

const RoomTombstoneCallTileViewWrapper = withViewDocs(RoomTombstoneCallTileViewWrapperImpl, DmTombstoneCallTileView);

const meta = {
    title: "Timeline/Timeline Event/Call/Tombstone/DmTombstoneCallTileView",
    component: RoomTombstoneCallTileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        timestamp: {
            control: { type: "text" },
        },
        callDirection: {
            options: [CallDirection.Incoming, CallDirection.Outgoing],
            control: { type: "radio" },
        },

        type: {
            options: [CallType.Voice, CallType.Video],
            control: { type: "radio" },
        },
    },
    args: {
        timestamp: "12:36",
        callDirection: CallDirection.Incoming,
        isCallDeclined: false,
        type: CallType.Voice,
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11217-3905&t=iEfhUcFrV01fQeyQ-4",
        },
    },
} satisfies Meta<typeof RoomTombstoneCallTileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VoiceEnded: Story = {
    args: {
        type: CallType.Voice,
    },
};

export const VideoEnded: Story = {
    args: {
        type: CallType.Video,
    },
};

export const IncomingVoiceDeclined: Story = {
    args: {
        type: CallType.Voice,
        callDirection: CallDirection.Incoming,
        isCallDeclined: true,
    },
};

export const IncomingVideoDeclined: Story = {
    args: {
        type: CallType.Video,
        callDirection: CallDirection.Incoming,
        isCallDeclined: true,
    },
};

export const OutgoingVoiceDeclined: Story = {
    args: {
        type: CallType.Voice,
        callDirection: CallDirection.Outgoing,
        isCallDeclined: true,
    },
};

export const OutgoingVideoDeclined: Story = {
    args: {
        type: CallType.Video,
        callDirection: CallDirection.Outgoing,
        isCallDeclined: true,
    },
};
