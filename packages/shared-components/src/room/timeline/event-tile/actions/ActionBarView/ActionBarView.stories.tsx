/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionBarAction, ActionBarView, type ActionBarViewActions, type ActionBarViewSnapshot } from "./ActionBarView";
import { useMockedViewModel } from "../../../../../viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";

type ActionBarProps = ActionBarViewSnapshot & ActionBarViewActions;

const ActionBarViewWrapperImpl = ({ ...snapshotAndActions }: ActionBarProps): JSX.Element => {
    const {
        onCancelClick = fn(),
        onCopyLinkClick = fn(),
        onDownloadClick = fn(),
        onEditClick = fn(),
        onHideClick = fn(),
        onOptionsClick = fn(),
        onPinClick = fn(),
        onReactionsClick = fn(),
        onRemoveClick = fn(),
        onReplyClick = fn(),
        onReplyInThreadClick = fn(),
        onResendClick = fn(),
        onToggleThreadExpanded = fn(),
        onViewInRoomClick = fn(),
        onViewSourceClick = fn(),
        ...snapshot
    } = snapshotAndActions;

    const vm = useMockedViewModel(snapshot, {
        onCancelClick,
        onCopyLinkClick,
        onDownloadClick,
        onEditClick,
        onHideClick,
        onOptionsClick,
        onPinClick,
        onReactionsClick,
        onRemoveClick,
        onReplyClick,
        onReplyInThreadClick,
        onResendClick,
        onToggleThreadExpanded,
        onViewInRoomClick,
        onViewSourceClick,
    });

    return <ActionBarView vm={vm} className="mx_MessageActionBar" />;
};
const ActionBarViewWrapper = withViewDocs(ActionBarViewWrapperImpl, ActionBarView);

const meta = {
    title: "Room/Timeline/EventTile/Actions/ActionBarView",
    component: ActionBarViewWrapper,
    tags: ["autodocs"],
    args: {
        actions: [
            ActionBarAction.Hide,
            ActionBarAction.Download,
            ActionBarAction.React,
            ActionBarAction.Reply,
            ActionBarAction.ReplyInThread,
            ActionBarAction.Edit,
            ActionBarAction.Pin,
            ActionBarAction.Resend,
            ActionBarAction.Cancel,
            ActionBarAction.Expand,
            ActionBarAction.Options,
            ActionBarAction.ViewInRoom,
            ActionBarAction.CopyLink,
            ActionBarAction.Remove,
            ActionBarAction.ViewSource,
        ],
        presentation: "icon",
        isDownloadEncrypted: false,
        isDownloadLoading: false,
        isPinned: false,
        isQuoteExpanded: false,
        isThreadReplyAllowed: true,
    },
    parameters: {
        docs: {
            description: {
                component:
                    "A compact message action toolbar that renders the resolved actions for a message. The stories below focus on icon and label presentation plus the remaining view-owned state transitions.",
            },
        },
    },
} satisfies Meta<typeof ActionBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIconActions: Story = {};

export const AllLabelActions: Story = {
    args: {
        actions: [
            ActionBarAction.Hide,
            ActionBarAction.Download,
            ActionBarAction.React,
            ActionBarAction.Reply,
            ActionBarAction.ReplyInThread,
            ActionBarAction.Edit,
            ActionBarAction.Pin,
            ActionBarAction.Resend,
            ActionBarAction.Cancel,
            ActionBarAction.Expand,
            ActionBarAction.Options,
            ActionBarAction.ViewInRoom,
            ActionBarAction.CopyLink,
            ActionBarAction.Remove,
            ActionBarAction.ViewSource,
        ],
        presentation: "label",
    },
};

export const DownloadingAttachment: Story = {
    args: {
        actions: [ActionBarAction.Download, ActionBarAction.Options],
        isDownloadLoading: true,
        isDownloadEncrypted: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Attachment download in progress. The download action is disabled and shows a spinner with the downloading label.",
            },
        },
    },
};

export const DecryptingAttachment: Story = {
    args: {
        ...DownloadingAttachment.args,
        isDownloadEncrypted: true,
    },
    parameters: {
        docs: {
            description: {
                story: "Encrypted attachment state. Uses the same loading UI as download, but with the decrypting label.",
            },
        },
    },
};

export const PinnedMessage: Story = {
    args: {
        actions: [ActionBarAction.React, ActionBarAction.Reply, ActionBarAction.Pin, ActionBarAction.Options],
        isPinned: true,
    },
    parameters: {
        docs: {
            description: {
                story: "Pinned-state variant showing the unpin affordance instead of pin.",
            },
        },
    },
};

export const ExpandedReplyChain: Story = {
    args: {
        actions: [ActionBarAction.Reply, ActionBarAction.Expand, ActionBarAction.Options],
        isQuoteExpanded: true,
    },
    parameters: {
        docs: {
            description: {
                story: "Reply-chain control in its expanded state, showing the collapse action and tooltip copy.",
            },
        },
    },
};

export const DisabledThreadReply: Story = {
    args: {
        actions: [ActionBarAction.React, ActionBarAction.Reply, ActionBarAction.ReplyInThread, ActionBarAction.Options],
        isThreadReplyAllowed: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Thread reply action present but disabled.",
            },
        },
    },
};
