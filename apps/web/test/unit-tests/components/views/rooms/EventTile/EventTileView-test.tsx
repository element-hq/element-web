/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { getByLabelText, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import type { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { mkMessage } from "../../../../../test-utils";
import { TimelineRenderingType } from "../../../../../../src/contexts/RoomContext";
import { Layout } from "../../../../../../src/settings/enums/Layout";
import { EventTileEncryptionIndicatorMode, SenderMode } from "../../../../../../src/components/views/rooms/EventTile/EventTileModes";
import { EventTileView, type EventTileViewProps } from "../../../../../../src/components/views/rooms/EventTile/EventTileView";

jest.mock("../../../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: ({ room }: { room: Room }) => <div data-testid="room-avatar">{room.name}</div>,
}));

jest.mock("../../../../../../src/components/views/rooms/NotificationBadge/UnreadNotificationBadge", () => ({
    UnreadNotificationBadge: () => <div data-testid="unread-badge" />,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/Avatar", () => ({
    Avatar: () => <div data-testid="avatar" />,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/EncryptionIndicator", () => ({
    EncryptionIndicator: ({
        icon,
        title,
        sharedUserId,
        roomId,
    }: {
        icon: string;
        title?: string;
        sharedUserId?: string;
        roomId?: string;
    }) => (
        <div data-testid="encryption-indicator">
            {icon}:{title}:{sharedUserId}:{roomId}
        </div>
    ),
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/MessageStatus", () => ({
    MessageStatus: () => <div data-testid="message-status" />,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/Sender", () => ({
    Sender: ({ mode, mxEvent }: { mode: string; mxEvent: MatrixEvent }) => (
        <div data-testid="sender">
            {mode}:{mxEvent.getSender()}
        </div>
    ),
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/Timestamp", () => ({
    Timestamp: () => <span data-testid="timestamp" />,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/ThreadInfo", () => ({
    ThreadInfo: ({ label }: { label?: string }) => <div data-testid="thread-info">{label}</div>,
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/ThreadPanelSummary", () => ({
    ThreadPanelSummary: ({ replyCount }: { replyCount: number }) => <div data-testid="thread-panel-summary">{replyCount}</div>,
}));

describe("EventTileView", () => {
    let mxEvent: MatrixEvent;

    function makeProps(overrides: Partial<EventTileViewProps> = {}): EventTileViewProps {
        return {
            id: "event",
            mxEvent,
            room: { name: "!roomId:example.org" } as Room,
            timelineRenderingType: TimelineRenderingType.Room,
            classes: "mx_EventTile",
            lineClasses: "mx_EventTile_line",
            isOwnEvent: false,
            isRenderingNotification: false,
            avatarViewUserOnClick: false,
            avatarForceHistorical: false,
            senderMode: SenderMode.Default,
            messageBody: <div>Message body</div>,
            hasFooter: false,
            showGroupPadlock: false,
            showIrcPadlock: false,
            encryptionIndicatorMode: EventTileEncryptionIndicatorMode.None,
            onMouseEnter: jest.fn(),
            onMouseLeave: jest.fn(),
            onFocus: jest.fn(),
            onBlur: jest.fn(),
            onContextMenu: jest.fn(),
            viewInRoom: jest.fn(),
            copyLinkToThread: jest.fn(),
            permalink: "#",
            ...overrides,
        };
    }

    beforeEach(() => {
        mxEvent = mkMessage({
            room: "!roomId:example.org",
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
    });

    it("renders the room name for notifications", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.Notification,
                    isRenderingNotification: true,
                })}
            />,
        );

        expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
            "default:@alice:example.org in !roomId:example.org",
        );
    });

    it("renders the sender for the thread list", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    senderMode: SenderMode.Tooltip,
                })}
            />,
        );

        expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
            "tooltip:@alice:example.org",
        );
    });

    it("renders the pinned message badge for thread tiles", () => {
        render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.Thread,
                    hasFooter: true,
                    pinnedMessageBadge: <div>Pinned message</div>,
                    layout: Layout.Group,
                })}
            />,
        );

        expect(screen.getByText("Pinned message")).toBeInTheDocument();
    });

    it("does not render the pinned message badge for file tiles", () => {
        render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.File,
                    hasFooter: true,
                    pinnedMessageBadge: <div>Pinned message</div>,
                })}
            />,
        );

        expect(screen.queryByText("Pinned message")).not.toBeInTheDocument();
    });

    it.each([[Layout.Group], [Layout.Bubble], [Layout.IRC]])(
        "renders the pinned message badge for default timeline layout %s",
        (layout) => {
            render(
                <EventTileView
                    {...makeProps({
                        layout,
                        hasFooter: true,
                        pinnedMessageBadge: <div>Pinned message</div>,
                    })}
                />,
            );

            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        },
    );

    it("renders the thread toolbar for thread list tiles", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    showThreadToolbar: true,
                })}
            />,
        );

        expect(getByLabelText(container, "View in room")).toBeInTheDocument();
        expect(getByLabelText(container, "Copy link to thread")).toBeInTheDocument();
    });

    it("wires thread toolbar callbacks", async () => {
        const viewInRoom = jest.fn();
        const copyLinkToThread = jest.fn();
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    showThreadToolbar: true,
                    viewInRoom,
                    copyLinkToThread,
                })}
            />,
        );

        await userEvent.click(getByLabelText(container, "Copy link to thread"));
        expect(copyLinkToThread).toHaveBeenCalledTimes(1);

        await userEvent.click(getByLabelText(container, "View in room"));
        expect(viewInRoom).toHaveBeenCalledTimes(1);
    });
});
