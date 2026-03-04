/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import { IconButton } from "@vector-im/compound-web";
import TriggerIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    type WidgetContextMenuAction,
    type WidgetContextMenuSnapshot,
    WidgetContextMenuView,
} from "./WidgetContextMenuView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type WidgetContextMenuViewModelProps = WidgetContextMenuSnapshot & WidgetContextMenuAction;

const WidgetContextMenuViewWrapperImpl = ({
    onStreamAudioClick,
    onEditClick,
    onSnapshotClick,
    onDeleteClick,
    onRevokeClick,
    onFinished,
    onMoveButton,
    ...rest
}: WidgetContextMenuViewModelProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onStreamAudioClick,
        onEditClick,
        onSnapshotClick,
        onDeleteClick,
        onRevokeClick,
        onFinished,
        onMoveButton,
    });
    return <WidgetContextMenuView vm={vm} />;
};
const WidgetContextMenuViewWrapper = withViewDocs(WidgetContextMenuViewWrapperImpl, WidgetContextMenuView);

const meta = {
    title: "RightPanel/WidgetContextMenuView",
    component: WidgetContextMenuViewWrapper,
    tags: ["autodocs"],
    args: {
        showStreamAudioStreamButton: true,
        showEditButton: true,
        showRevokeButton: true,
        showDeleteButton: true,
        showSnapshotButton: true,
        showMoveButtons: [true, true],
        canModify: true,
        isMenuOpened: true,
        trigger: (
            <IconButton size="24px" aria-label="context menu trigger button" inert={true} tabIndex={-1}>
                <TriggerIcon />
            </IconButton>
        ),
        onStreamAudioClick: fn(),
        onEditClick: fn(),
        onSnapshotClick: fn(),
        onDeleteClick: fn(),
        onRevokeClick: fn(),
        onFinished: fn(),
        onMoveButton: fn(),
    },
} satisfies Meta<typeof WidgetContextMenuViewWrapper>;

export default meta;
type Story = StoryObj<typeof WidgetContextMenuViewWrapper>;

export const Default: Story = {};

export const OnlyBasicModification: Story = {
    args: {
        showSnapshotButton: false,
        showMoveButtons: [false, false],
        showStreamAudioStreamButton: false,
        showEditButton: false,
    },
};
