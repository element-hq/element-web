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

type WrapperProps = ActionBarViewSnapshot &
    Partial<ActionBarViewActions> & {
        open?: boolean;
    };

const ActionBarViewWrapper = ({ ...snapshotAndActions }: WrapperProps): JSX.Element => {
    const {
        onEditClick = fn(),
        onPinClick = fn(),
        onResendClick = fn(),
        onCancelClick = fn(),
        onDownloadClick = fn(),
        onHideClick = fn(),
        onReplyClick = fn(),
        onReplyInThreadClick = fn(),
        onToggleThreadExpanded = fn(),
        open = true,
        ...snapshot
    } = snapshotAndActions;

    const vm = useMockedViewModel(snapshot, {
        onEditClick,
        onPinClick,
        onResendClick,
        onCancelClick,
        onDownloadClick,
        onHideClick,
        onReplyClick,
        onReplyInThreadClick,
        onToggleThreadExpanded,
    });

    return (
        <ActionBarView
            vm={vm}
            open={open}
            trigger={
                <div
                    style={{
                        marginTop: "100px",
                        marginBottom: "100px",
                        marginLeft: "30%",
                        marginRight: "30%",
                        display: "flex",
                        justifyContent: "center",
                        border: "1px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        outline: "var(--cpd-border-width-1) solid var(--cpd-color-border-interactive-secondary)",
                    }}
                >
                    Actions trigger container
                </div>
            }
        />
    );
};

const meta = {
    title: "MessageAction/ActionBarView",
    component: ActionBarViewWrapper,
    tags: ["autodocs"],
    args: {
        open: false,
        side: "top",
        align: "end",
        canEdit: true,
        canPinOrUnpin: true,
        isPinned: false,
        allowCancel: true,
        isFailed: false,
        isContentActionable: true,
        canSendMessages: true,
        canReact: true,
        hasThreadRelation: true,
        isDownloadEncrypted: false,
        isDownloadLoading: false,
        showReplyInThreadAction: true,
        showThreadForDeletedMessage: true,
        showDownloadAction: true,
        showHideAction: true,
        showExpandCollapseAction: true,
        isQuoteExpanded: false,
    },
    argTypes: {
        open: { control: "boolean" },
        side: { control: "select", options: ["top", "right", "bottom", "left"] },
        align: { control: "select", options: ["start", "center", "end"] },
    },
} satisfies Meta<typeof ActionBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
