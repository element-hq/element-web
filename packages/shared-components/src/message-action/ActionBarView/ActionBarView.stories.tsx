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
import { withViewDocs } from "../../../.storybook/withViewDocs";

type ActionBarProps = ActionBarViewSnapshot & ActionBarViewActions;

const ActionBarViewWrapperImpl = ({ ...snapshotAndActions }: ActionBarProps): JSX.Element => {
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
const ActionBarViewWrapper = withViewDocs(ActionBarViewWrapperImpl, ActionBarView);

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
    parameters: {
        docs: {
            description: {
                component:
                    "A compact message action toolbar that renders only the actions available for the current message state. The stories below focus on the main rendering branches: normal messages, failed events, attachment download states, thread restrictions, and reply-chain expansion.",
            },
        },
    },
} satisfies Meta<typeof ActionBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TypicalMessage: Story = {
    args: {
        showHide: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: false,
        showPinOrUnpin: false,
        showCancel: false,
        showReact: true,
        showReply: true,
        showReplyInThread: true,
        showThreadForDeletedMessage: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Common non-failed message state with reaction, reply, thread reply, and overflow actions.",
            },
        },
    },
};

export const FailedMessage: Story = {
    args: {
        showCancel: true,
        isFailed: true,
        showDownload: true,
        showEdit: true,
        showExpandCollapse: true,
        showHide: true,
        showPinOrUnpin: true,
        showReact: true,
        showReply: true,
        showReplyInThread: true,
    },
    parameters: {
        docs: {
            description: {
                story: "Failed event branch. When `showCancel` and `isFailed` are both true, the toolbar collapses to retry and delete only.",
            },
        },
    },
};

export const DownloadingAttachment: Story = {
    args: {
        showHide: false,
        showDownload: true,
        showEdit: false,
        showExpandCollapse: false,
        showPinOrUnpin: false,
        showReact: false,
        showReply: false,
        showReplyInThread: false,
        showThreadForDeletedMessage: false,
        showCancel: false,
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
        showHide: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: false,
        showPinOrUnpin: true,
        showReact: true,
        showReply: true,
        showReplyInThread: false,
        showThreadForDeletedMessage: false,
        showCancel: false,
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
        showHide: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: true,
        showPinOrUnpin: false,
        showReact: false,
        showReply: true,
        showReplyInThread: false,
        showThreadForDeletedMessage: false,
        showCancel: false,
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

export const ThreadReplyDisabled: Story = {
    args: {
        showHide: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: false,
        showPinOrUnpin: false,
        showReact: true,
        showReply: true,
        showReplyInThread: true,
        showThreadForDeletedMessage: false,
        showCancel: false,
        isThreadReplyAllowed: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Thread reply is present but disabled because the event cannot start a thread.",
            },
        },
    },
};

export const DeletedMessageThreadOnly: Story = {
    args: {
        showHide: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: false,
        showPinOrUnpin: false,
        showReact: false,
        showReply: false,
        showReplyInThread: false,
        showThreadForDeletedMessage: true,
        showCancel: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Deleted-message case where reply is hidden but a thread affordance is still shown.",
            },
        },
    },
};

export const Minimal: Story = {
    args: {
        showCancel: false,
        showDownload: false,
        showEdit: false,
        showExpandCollapse: false,
        showHide: false,
        showPinOrUnpin: false,
        showReact: false,
        showReply: false,
        showReplyInThread: false,
        showThreadForDeletedMessage: false,
    },
    parameters: {
        docs: {
            description: {
                story: "Smallest normal toolbar state. All optional actions are disabled, leaving only the overflow menu.",
            },
        },
    },
};
