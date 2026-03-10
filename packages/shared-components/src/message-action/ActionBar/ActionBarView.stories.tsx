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
        onCancelClick = fn(),
        onDownloadClick = fn(),
        onEditClick = fn(),
        onHideClick = fn(),
        onOptionsClick = fn(),
        onPinClick = fn(),
        onReactClick = fn(),
        onReplyClick = fn(),
        onReplyInThreadClick = fn(),
        onResendClick = fn(),
        onToggleThreadExpanded = fn(),
        open = true,
        ...snapshot
    } = snapshotAndActions;

    const vm = useMockedViewModel(snapshot, {
        onCancelClick,
        onDownloadClick,
        onEditClick,
        onHideClick,
        onOptionsClick,
        onPinClick,
        onReactClick,
        onReplyClick,
        onReplyInThreadClick,
        onResendClick,
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
        align: "end",
        side: "top",
        canCancel: true,
        canEdit: true,
        canPinOrUnpin: true,
        canReact: true,
        canSendMessages: true,
        showDownloadAction: true,
        showExpandCollapseAction: true,
        showHideAction: true,
        showReplyInThreadAction: true,
        showThreadForDeletedMessage: true,
        hasThreadRelation: true,
        isContentActionable: true,
        isDownloadEncrypted: false,
        isDownloadLoading: false,
        isFailed: false,
        isPinned: false,
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
