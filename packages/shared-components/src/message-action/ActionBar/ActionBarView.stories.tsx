/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionBarView, type ActionBarViewActions, type ActionBarViewSnapshot } from "./ActionBarView";
import { useMockedViewModel } from "../../viewmodel";

type ActionBarProps = ActionBarViewSnapshot & ActionBarViewActions;

const ActionBarViewWrapper = ({ ...snapshotAndActions }: ActionBarProps): JSX.Element => {
    const {
        onCancelClick = fn(),
        onDownloadClick = fn(),
        onEditClick = fn(),
        onHideClick = fn(),
        onOptionsClick = fn(),
        onPinClick = fn(),
        onReactionsClick = fn(),
        onReplyClick = fn(),
        onReplyInThreadClick = fn(),
        onResendClick = fn(),
        onToggleThreadExpanded = fn(),
        ...snapshot
    } = snapshotAndActions;

    const vm = useMockedViewModel(snapshot, {
        onCancelClick,
        onDownloadClick,
        onEditClick,
        onHideClick,
        onOptionsClick,
        onPinClick,
        onReactionsClick,
        onReplyClick,
        onReplyInThreadClick,
        onResendClick,
        onToggleThreadExpanded,
    });

    return <ActionBarView vm={vm} className="mx_MessageActionBar" />;
};

const meta = {
    title: "MessageAction/ActionBarView",
    component: ActionBarViewWrapper,
    tags: ["autodocs"],
    args: {
        showCancel: true,
        showDownload: true,
        showEdit: true,
        showExpandCollapse: true,
        showHide: true,
        showPinOrUnpin: true,
        showReact: true,
        showReply: true,
        showReplyInThread: true,
        showThreadForDeletedMessage: true,
        isDownloadEncrypted: false,
        isDownloadLoading: false,
        isFailed: false,
        isPinned: false,
        isQuoteExpanded: false,
        isThreadReplyAllowed: true,
    },
} satisfies Meta<typeof ActionBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
