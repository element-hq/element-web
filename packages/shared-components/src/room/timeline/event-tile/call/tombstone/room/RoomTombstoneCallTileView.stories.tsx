/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomTombstoneCallTileView, type RoomTombstoneCallTileViewSnapshot } from "./RoomTombstoneCallTileView";
import { useMockedViewModel } from "../../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../../.storybook/withViewDocs";

const RoomTombstoneCallTileViewWrapperImpl = ({ ...rest }: RoomTombstoneCallTileViewSnapshot): React.ReactNode => {
    const vm = useMockedViewModel(rest, {});
    return <RoomTombstoneCallTileView vm={vm} />;
};

const RoomTombstoneCallTileViewWrapper = withViewDocs(RoomTombstoneCallTileViewWrapperImpl, RoomTombstoneCallTileView);

const meta = {
    title: "Timeline/Timeline Event/Call/Tombstone/RoomTombstoneCallTileView",
    component: RoomTombstoneCallTileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        timestamp: {
            control: { type: "text" },
        },
    },
    args: {
        timestamp: "12:36",
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11217-3902&t=oRWAGiwV5pUV4OFF-4",
        },
    },
} satisfies Meta<typeof RoomTombstoneCallTileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
