/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import { ImageReplyBodyView, type ImageReplyBodyViewSnapshot } from "./ImageReplyBodyView";

const MockThumbnail = (): JSX.Element => (
    <div className="mx_MImageBody_thumbnail_container">
        <div role="img" aria-label="Reply image preview">
            Thumbnail
        </div>
    </div>
);

const ImageReplyBodyViewWrapper = ({
    className,
    children,
    ...snapshotProps
}: ImageReplyBodyViewSnapshot & { children?: React.ReactNode; className?: string }): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});

    return (
        <ImageReplyBodyView vm={vm} className={className}>
            {children}
        </ImageReplyBodyView>
    );
};

const meta = {
    title: "MessageBody/ImageReplyBodyView",
    component: ImageReplyBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        isVisible: true,
        children: <MockThumbnail />,
    },
} satisfies Meta<typeof ImageReplyBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
    args: {
        children: undefined,
    },
};

export const Hidden: Story = {
    args: {
        isVisible: false,
    },
};
