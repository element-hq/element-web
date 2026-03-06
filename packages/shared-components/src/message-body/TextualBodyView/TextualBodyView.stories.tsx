/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import { TextualBodyView, type TextualBodyViewActions, type TextualBodyViewSnapshot } from "./TextualBodyView";

type WrapperProps = TextualBodyViewSnapshot & Partial<TextualBodyViewActions> & { className?: string };

function TextualBodyViewWrapper({
    onBodyClick,
    onEditedMarkerClick,
    onEmoteSenderClick,
    className,
    ...snapshotProps
}: Readonly<WrapperProps>): JSX.Element {
    const vm = useMockedViewModel(snapshotProps, {
        onBodyClick: onBodyClick ?? fn(),
        onEditedMarkerClick: onEditedMarkerClick ?? fn(),
        onEmoteSenderClick: onEmoteSenderClick ?? fn(),
    });

    return <TextualBodyView vm={vm} className={className} />;
}

const meta = {
    title: "MessageBody/TextualBodyView",
    component: TextualBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        id: "textual-body-view",
        kind: "text",
        body: "Hello from TextualBodyView",
    },
} satisfies Meta<typeof TextualBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Notice: Story = {
    args: {
        kind: "notice",
        body: "This is a notice message.",
    },
};

export const Caption: Story = {
    args: {
        kind: "caption",
        body: "This is a caption body.",
    },
};

export const Emote: Story = {
    args: {
        kind: "emote",
        emoteSender: "Alice",
        body: "waves enthusiastically",
    },
};

export const Edited: Story = {
    args: {
        editedMarkerText: "(edited)",
        editedMarkerLabel: "Message edited at 10:24",
        editedMarkerDescription: "Edited at 10:24",
        editedMarkerCaption: "Click to open edit history",
    },
};

export const PendingModeration: Story = {
    args: {
        pendingModerationText: "pending moderation",
    },
};

export const WithWidgets: Story = {
    args: {
        kind: "text",
        body: "Message with URL preview widgets",
        editedMarkerText: "(edited)",
        editedMarkerLabel: "Message edited",
        pendingModerationText: "pending moderation because of policy checks",
        widgets: <div>Mock URL preview widget</div>,
    },
};
