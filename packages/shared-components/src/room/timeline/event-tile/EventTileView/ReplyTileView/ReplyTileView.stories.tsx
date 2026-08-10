/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReplyTileView } from "./ReplyTileView";

const sender = (
    <>
        <span
            aria-hidden="true"
            className="mx_BaseAvatar"
            style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#0d77d9" }}
        />
        <span className="mx_DisambiguatedProfile">Alice</span>
    </>
);

const body = (
    <div className="mx_EventTile_content">
        <div className="mx_MTextBody mx_EventTile_body markdown-body">
            <p>This is a reply preview shown inside the timeline.</p>
        </div>
    </div>
);

const meta = {
    title: "Timeline/EventTile/ReplyTileView",
    component: ReplyTileView,
    tags: ["autodocs"],
    args: {
        href: "#/room/!example:example.org/$event",
        onClick: fn(),
        sender,
        children: body,
    },
} satisfies Meta<typeof ReplyTileView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inline: Story = {
    args: {
        inline: true,
        children: "Alice waves hello",
    },
};

export const Informational: Story = {
    args: {
        info: true,
        sender: undefined,
        children: "Alice joined the room",
    },
};

export const WithoutSender: Story = {
    args: {
        sender: undefined,
        children: "A reply without sender presentation",
    },
};

export const LongEditedReply: Story = {
    decorators: [
        (Story) => (
            <div style={{ width: 320 }}>
                <Story />
            </div>
        ),
    ],
    args: {
        children: (
            <div className="mx_EventTile_content">
                <div data-textual-body-annotation-wrapper>
                    <div className="mx_MTextBody mx_EventTile_body markdown-body">
                        <p>
                            This deliberately long edited reply demonstrates that production-shaped textual content is
                            constrained to two lines instead of overflowing the compact reply preview.
                        </p>
                    </div>
                    <span data-textual-body-edited-marker>Edited</span>
                </div>
            </div>
        ),
    },
};
