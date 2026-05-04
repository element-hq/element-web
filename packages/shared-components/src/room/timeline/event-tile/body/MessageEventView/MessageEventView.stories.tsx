/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { MessageEventView, type MessageEventViewSnapshot } from "./MessageEventView";

type WrapperProps = MessageEventViewSnapshot & Omit<ComponentProps<typeof MessageEventView>, "vm">;

const MockPrimaryBody = (): JSX.Element => <div data-testid="message-event-primary-body">Primary body</div>;

const MockCaptionBody = (): JSX.Element => <div data-testid="message-event-caption-body">Caption body</div>;

const MessageEventViewWrapperImpl = ({
    className,
    children = <MockPrimaryBody />,
    caption = <MockCaptionBody />,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});

    return (
        <MessageEventView vm={vm} className={className} caption={caption}>
            {children}
        </MessageEventView>
    );
};

const MessageEventViewWrapper = withViewDocs(MessageEventViewWrapperImpl, MessageEventView);

const meta = {
    title: "MessageBody/MessageEventView",
    component: MessageEventViewWrapper,
    tags: ["autodocs"],
    args: {
        hasCaption: false,
    },
} satisfies Meta<typeof MessageEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCaption: Story = {
    args: {
        hasCaption: true,
    },
};
