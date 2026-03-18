/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { getByLabelText, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { TimelineRenderingType } from "../../../../../../src/contexts/RoomContext";
import { Layout } from "../../../../../../src/settings/enums/Layout";
import { EncryptionIndicatorMode } from "../../../../../../src/components/views/rooms/EventTile/constants";
import {
    EventTileView,
    type EventTileViewProps,
} from "../../../../../../src/components/views/rooms/EventTile/EventTileView";

type EventTileViewOverrides = Omit<
    Partial<EventTileViewProps>,
    "content" | "threads" | "timestamp" | "encryption" | "notification" | "handlers"
> & {
    content?: Partial<EventTileViewProps["content"]>;
    threads?: Partial<EventTileViewProps["threads"]>;
    timestamp?: Partial<EventTileViewProps["timestamp"]>;
    encryption?: Partial<EventTileViewProps["encryption"]>;
    notification?: Partial<EventTileViewProps["notification"]>;
    handlers?: Partial<EventTileViewProps["handlers"]>;
};

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

jest.mock("../../../../../../src/components/views/rooms/EventTile/Timestamp", () => ({
    Timestamp: ({ ts, href }: { ts: number; href?: string }) => (
        <span data-testid={href ? "linked-timestamp" : "timestamp"}>{href ? `${href}:${ts}` : ts}</span>
    ),
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/ThreadInfo", () => ({
    ThreadInfo: ({ summary, href, label }: { summary?: React.ReactNode; href?: string; label?: string }) =>
        summary ? (
            <div data-testid="thread-info-summary">{summary}</div>
        ) : href ? (
            <a data-testid="thread-info-link" href={href}>
                {label}
            </a>
        ) : (
            <div data-testid="thread-info-text">{label}</div>
        ),
}));

jest.mock("../../../../../../src/components/views/rooms/EventTile/ThreadPanelSummary", () => ({
    ThreadPanelSummary: ({ replyCount }: { replyCount: number }) => (
        <div data-testid="thread-panel-summary">{replyCount}</div>
    ),
}));

describe("EventTileView", () => {
    function makeProps(overrides: EventTileViewOverrides = {}): EventTileViewProps {
        const baseProps: EventTileViewProps = {
            contentId: "event",
            eventId: "$event:example.org",
            timelineRenderingType: TimelineRenderingType.Room,
            rootClassName: "mx_EventTile",
            contentClassName: "mx_EventTile_line",
            isOwnEvent: false,
            content: {
                sender: <div data-testid="sender">default:@alice:example.org</div>,
                messageBody: <div>Message body</div>,
            },
            threads: {
                openInRoom: jest.fn(),
                copyLinkToThread: jest.fn(),
            },
            timestamp: {
                permalink: "#",
            },
            encryption: {
                showGroupPadlock: false,
                showIrcPadlock: false,
                mode: EncryptionIndicatorMode.None,
            },
            notification: {
                enabled: false,
            },
            handlers: {
                onMouseEnter: jest.fn(),
                onMouseLeave: jest.fn(),
                onFocus: jest.fn(),
                onBlur: jest.fn(),
                onContextMenu: jest.fn(),
            },
        };

        return {
            ...baseProps,
            ...overrides,
            content: {
                ...baseProps.content,
                ...overrides.content,
            },
            threads: {
                ...baseProps.threads,
                ...overrides.threads,
            },
            timestamp: {
                ...baseProps.timestamp,
                ...overrides.timestamp,
            },
            encryption: {
                ...baseProps.encryption,
                ...overrides.encryption,
            },
            notification: {
                ...baseProps.notification,
                ...overrides.notification,
            },
            handlers: {
                ...baseProps.handlers,
                ...overrides.handlers,
            },
        };
    }

    it("renders the notification room label slot", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.Notification,
                    notification: {
                        enabled: true,
                        roomLabel: (
                            <>
                                {" in "}
                                <strong>!roomId:example.org</strong>
                            </>
                        ),
                    },
                })}
            />,
        );

        expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
            "default:@alice:example.org in !roomId:example.org",
        );
    });

    it("renders the sender slot for the thread list", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    content: {
                        sender: <div data-testid="sender">tooltip:@alice:example.org</div>,
                    },
                })}
            />,
        );

        expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
            "tooltip:@alice:example.org",
        );
    });

    it("renders thread info summary content", () => {
        render(
            <EventTileView
                {...makeProps({
                    threads: {
                        info: <div data-testid="thread-info-summary">Thread summary</div>,
                    },
                })}
            />,
        );

        expect(screen.getByTestId("thread-info-summary")).toHaveTextContent("Thread summary");
    });

    it("renders thread info links", () => {
        render(
            <EventTileView
                {...makeProps({
                    threads: {
                        info: (
                            <a data-testid="thread-info-link" href="#thread">
                                In thread
                            </a>
                        ),
                    },
                })}
            />,
        );

        expect(screen.getByTestId("thread-info-link")).toHaveAttribute("href", "#thread");
        expect(screen.getByTestId("thread-info-link")).toHaveTextContent("In thread");
    });

    it("renders thread info text when no link is provided", () => {
        render(
            <EventTileView
                {...makeProps({
                    threads: {
                        info: <div data-testid="thread-info-text">In thread</div>,
                    },
                })}
            />,
        );

        expect(screen.getByTestId("thread-info-text")).toHaveTextContent("In thread");
    });

    it("renders the pinned message badge for thread tiles", () => {
        render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.Thread,
                    content: {
                        footer: <div>Pinned message</div>,
                    },
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
                    content: {
                        footer: <div>Pinned message</div>,
                    },
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
                        content: {
                            footer: <div>Pinned message</div>,
                        },
                    })}
                />,
            );

            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        },
    );

    it("renders a timestamp when showTimestamp is true in the thread list", () => {
        render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    timestamp: {
                        show: true,
                        ts: 123,
                    },
                })}
            />,
        );

        expect(screen.getByTestId("timestamp")).toHaveTextContent("123");
    });

    it("renders a linked timestamp when enabled", () => {
        render(
            <EventTileView
                {...makeProps({
                    timestamp: {
                        show: true,
                        showLinked: true,
                        ts: 123,
                        permalink: "#event",
                    },
                })}
            />,
        );

        expect(screen.getByTestId("linked-timestamp")).toHaveTextContent("#event:123");
    });

    it("renders an IRC dummy timestamp placeholder", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    layout: Layout.IRC,
                    timestamp: {
                        showLinked: true,
                        showPlaceholder: true,
                    },
                })}
            />,
        );

        expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
    });

    it("renders the encryption indicator for group layouts", () => {
        render(
            <EventTileView
                {...makeProps({
                    encryption: {
                        showGroupPadlock: true,
                        mode: EncryptionIndicatorMode.Warning,
                        indicatorTitle: "Warning",
                        sharedKeysUserId: "@bob:example.org",
                        sharedKeysRoomId: "!room:example.org",
                    },
                })}
            />,
        );

        expect(screen.getByTestId("encryption-indicator")).toHaveTextContent(
            "warning:Warning:@bob:example.org:!room:example.org",
        );
    });

    it("renders the encryption indicator for IRC layouts", () => {
        render(
            <EventTileView
                {...makeProps({
                    layout: Layout.IRC,
                    encryption: {
                        showIrcPadlock: true,
                        mode: EncryptionIndicatorMode.Normal,
                        indicatorTitle: "Info",
                    },
                })}
            />,
        );

        expect(screen.getByTestId("encryption-indicator")).toHaveTextContent("normal:Info");
    });

    it("renders the thread toolbar for thread list tiles", () => {
        const { container } = render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    threads: {
                        showToolbar: true,
                    },
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
                    threads: {
                        showToolbar: true,
                        openInRoom: viewInRoom,
                        copyLinkToThread,
                    },
                })}
            />,
        );

        await userEvent.click(getByLabelText(container, "Copy link to thread"));
        expect(copyLinkToThread).toHaveBeenCalledTimes(1);

        await userEvent.click(getByLabelText(container, "View in room"));
        expect(viewInRoom).toHaveBeenCalledTimes(1);
    });

    it("renders sent receipt status", () => {
        render(
            <EventTileView
                {...makeProps({
                    content: {
                        messageStatus: (
                            <div data-testid="message-status">
                                <div data-testid="sent-receipt">sent</div>
                            </div>
                        ),
                    },
                })}
            />,
        );

        expect(screen.getByTestId("sent-receipt")).toHaveTextContent("sent");
    });

    it("renders read receipts status", () => {
        render(
            <EventTileView
                {...makeProps({
                    content: {
                        messageStatus: (
                            <div data-testid="message-status">
                                <div data-testid="read-receipts">readers</div>
                            </div>
                        ),
                    },
                })}
            />,
        );

        expect(screen.getByTestId("read-receipts")).toHaveTextContent("readers");
    });

    it("does not render a footer when there is no pinned badge or reactions", () => {
        const { container } = render(<EventTileView {...makeProps()} />);

        expect(container.querySelector(".mx_EventTile_footer")).toBeNull();
    });
});
