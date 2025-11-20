/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { useMockedViewModel } from "../../useMockedViewModel";
import { WidgetContextMenuAction, WidgetContextMenuSnapshot, WidgetContextMenuView } from "./WidgetContextMenuView";
import { IconButton } from "@vector-im/compound-web";
import TriggerIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

type WidgetContextMenuViewModelProps = WidgetContextMenuSnapshot & WidgetContextMenuAction;

const WidgetContextMenuViewWrapper = ({
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

export default {
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
        widgetMessaging: undefined,
        isMenuOpened: true,
        trigger: (
            <IconButton size="24px">
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
} as Meta<typeof WidgetContextMenuViewWrapper>;

const Template: StoryFn<typeof WidgetContextMenuViewWrapper> = (args) => <WidgetContextMenuViewWrapper {...args} />;

export const Default = Template.bind({});

export const OnlyBasicModification = Template.bind({});
OnlyBasicModification.args = {
    showSnapshotButton: false,
    showMoveButtons: [false, false],
    showStreamAudioStreamButton: false,
    showEditButton: false,
};
