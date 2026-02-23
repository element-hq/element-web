/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    MessageTimestampView,
    type MessageTimestampViewActions,
    type MessageTimestampViewSnapshot,
} from "./MessageTimestampView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type MessageTimestampProps = MessageTimestampViewSnapshot & MessageTimestampViewActions;
const MessageTimestampWrapperImpl = ({ onClick, onContextMenu, ...rest }: MessageTimestampProps): ReactNode => {
    const vm = useMockedViewModel(rest, {
        onClick,
        onContextMenu,
    });
    return <MessageTimestampView vm={vm} />;
};
const MessageTimestampWrapper = withViewDocs(MessageTimestampWrapperImpl, MessageTimestampView);

const meta = {
    title: "MessageBody/MessageTimestamp",
    component: MessageTimestampWrapper,
    tags: ["autodocs"],
    args: {
        ts: "04:58",
        tsSentAt: "Thu, 17 Nov 2022, 4:58:32 pm",
        tsReceivedAt: "",
        inhibitTooltip: false,
        className: "",
        href: "",
    },
} satisfies Meta<typeof MessageTimestampWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByText("04:58"));
        await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
    },
};

export const HasTsReceivedAt: Story = {
    args: {
        tsReceivedAt: "Thu, 17 Nov 2022, 4:58:33 pm",
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByText("04:58"));
        await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
    },
};

export const HasInhibitTooltip: Story = {
    args: {
        inhibitTooltip: true,
    },
};

export const HasExtraClassNames: Story = {
    args: {
        className: "extra_class_1 extra_class_2",
    },
};

export const HasHref: Story = {
    args: {
        href: "~",
    },
};

export const HasActions: Story = {
    args: {
        onClick: () => console.log("Clicked message timestamp"),
        onContextMenu: () => console.log("Context menu on message timestamp"),
    },
};
