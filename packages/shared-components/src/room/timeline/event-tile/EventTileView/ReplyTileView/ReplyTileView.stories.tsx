/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { ReplyTileView, type ReplyTileViewActions, type ReplyTileViewSnapshot } from "./ReplyTileView";

type WrapperProps = ReplyTileViewSnapshot &
    Partial<ReplyTileViewActions> & {
        sender?: ReactNode;
        children?: ReactNode;
        className?: string;
    };

const ReplyBody = (): JSX.Element => (
    <span data-reply-body-content="">
        <span>This is the replied-to message preview.</span>
    </span>
);

const ReplyTileViewWrapperImpl = ({
    onClick,
    sender,
    children,
    className,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onClick: onClick ?? fn(),
    });

    return (
        <ReplyTileView vm={vm} sender={sender} className={className}>
            {children}
        </ReplyTileView>
    );
};

const ReplyTileViewWrapper = withViewDocs(ReplyTileViewWrapperImpl, ReplyTileView);

const meta = {
    title: "Timeline/EventTile/ReplyTileView",
    component: ReplyTileViewWrapper,
    tags: ["autodocs"],
    args: {
        permalink: "#",
        isInline: false,
        isInfoMessage: false,
        showSender: true,
        sender: (
            <>
                <span data-reply-tile-avatar="">A</span>
                <span data-reply-tile-sender-profile="">Alice</span>
            </>
        ),
        children: <ReplyBody />,
    },
} satisfies Meta<typeof ReplyTileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inline: Story = {
    args: {
        isInline: true,
    },
};

export const Info: Story = {
    args: {
        isInfoMessage: true,
        showSender: false,
    },
};

export const NoRenderer: Story = {
    args: {
        isInfoMessage: true,
        showSender: false,
        noRendererMessage: "Unable to render message",
        children: undefined,
    },
};
