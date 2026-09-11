/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
    ForwardDialogView,
    type ForwardDialogRoom,
    type ForwardDialogViewActions,
    type ForwardDialogViewSnapshot,
} from "./ForwardDialogView";
import { useMockedViewModel } from "../../core/viewmodel";
import { mockAvatar } from "../../room-list/story-mocks";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type ForwardDialogViewStoryProps = ForwardDialogViewSnapshot & ForwardDialogViewActions;

const ForwardDialogViewWrapperImpl = ({
    search,
    send,
    openRoom,
    showAllRooms,
    renderRoomAvatar,
    ...snapshot
}: ForwardDialogViewStoryProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, {
        search,
        send,
        openRoom,
        showAllRooms,
        renderRoomAvatar,
    });
    return <ForwardDialogView vm={vm} preview={<MockPreview />} style={{ height: "600px" }} />;
};
const ForwardDialogViewWrapper = withViewDocs(ForwardDialogViewWrapperImpl, ForwardDialogView);

/** Stand-in for the EventTile the web app injects as the preview. */
function MockPreview(): JSX.Element {
    return (
        <div
            style={{
                display: "flex",
                gap: "12px",
                padding: "8px",
                border: "1px dashed var(--cpd-color-border-interactive-secondary)",
                borderRadius: "8px",
            }}
        >
            {mockAvatar("Me")}
            <div>
                <div style={{ fontWeight: "var(--cpd-font-weight-semibold)" }}>Me</div>
                <div>Hello world! This is the message being forwarded.</div>
            </div>
        </div>
    );
}

const makeRoom = (id: string, name: string, overrides: Partial<ForwardDialogRoom> = {}): ForwardDialogRoom => ({
    id: `!${id}:example.org`,
    name,
    description: "Element",
    canSend: true,
    sendState: "can_send",
    ...overrides,
});

const rooms: ForwardDialogRoom[] = [
    makeRoom("design", "Design"),
    makeRoom("engineering", "Engineering"),
    makeRoom("random", "Random"),
    makeRoom("announcements", "Announcements", { canSend: false }),
    makeRoom("alice", "Alice", { description: "" }),
];

const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

const meta = {
    title: "Room/ForwardDialogView",
    component: ForwardDialogViewWrapper,
    tags: ["autodocs"],
    args: {
        rooms,
        truncateAt: 20,
        search: fn(),
        send: fn(),
        openRoom: fn(),
        showAllRooms: fn(),
        renderRoomAvatar: (roomId: string) => mockAvatar(roomNames.get(roomId) ?? "Room"),
    },
} satisfies Meta<typeof ForwardDialogViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SendStates: Story = {
    args: {
        rooms: [
            makeRoom("design", "Design"),
            makeRoom("engineering", "Engineering", { sendState: "sending" }),
            makeRoom("random", "Random", { sendState: "sent" }),
            makeRoom("alice", "Alice", { sendState: "failed" }),
            makeRoom("announcements", "Announcements", { canSend: false }),
        ],
    },
};

export const Truncated: Story = {
    args: {
        truncateAt: 2,
    },
};

export const NoResults: Story = {
    args: {
        rooms: [],
    },
};
