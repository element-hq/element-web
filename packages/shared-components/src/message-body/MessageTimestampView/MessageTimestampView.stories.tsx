/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    MessageTimestampView,
    type MessageTimestampViewActions,
    type MessageTimestampViewSnapshot,
} from "./MessageTimestampView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";

type MessageTimestampProps = MessageTimestampViewSnapshot & MessageTimestampViewActions;
const MessageTimestampWrapper = ({ onClick, onContextMenu, ...rest }: MessageTimestampProps): ReactNode => {
    const vm = useMockedViewModel(rest, {
        onClick,
        onContextMenu,
    });
    return <MessageTimestampView vm={vm} />;
};

export default {
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
} as Meta<typeof MessageTimestampWrapper>;

const Template: StoryFn<typeof MessageTimestampWrapper> = (args) => <MessageTimestampWrapper {...args} />;

export const Default = Template.bind({});
Default.play = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByText("04:58"));
    await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
};

export const HasTsReceivedAt = Template.bind({});
HasTsReceivedAt.args = {
    tsReceivedAt: "Thu, 17 Nov 2022, 4:58:33 pm",
};
HasTsReceivedAt.play = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByText("04:58"));
    await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
};

export const HasInhibitTooltip = Template.bind({});
HasInhibitTooltip.args = {
    inhibitTooltip: true,
};
HasInhibitTooltip.play = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByText("04:58"));
    await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
};

export const HasExtraClassNames = Template.bind({});
HasExtraClassNames.args = {
    className: "extra_class_1 extra_class_2",
};

export const HasHref = Template.bind({});
HasHref.args = {
    href: "~",
};

export const HasActions = Template.bind({});
HasActions.args = {
    onClick: () => console.log("Clicked message timestamp"),
    onContextMenu: () => console.log("Context menu on message timestamp"),
};
