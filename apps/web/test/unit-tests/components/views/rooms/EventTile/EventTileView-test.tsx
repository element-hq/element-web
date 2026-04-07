/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { getByLabelText, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { TimelineRenderingType } from "../../../../../../src/contexts/RoomContext";
import {
    EncryptionIndicatorMode,
    PadlockMode,
    TimestampDisplayMode,
    TimestampFormatMode,
} from "../../../../../../src/models/rooms/EventTileModel";
import { Layout } from "../../../../../../src/settings/enums/Layout";
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
                sender: <button data-testid="sender">default:@alice:example.org</button>,
                messageBody: <div>Message body</div>,
            },
            threads: {
                toolbar: undefined,
            },
            timestamp: {
                displayMode: TimestampDisplayMode.Linked,
                formatMode: TimestampFormatMode.Absolute,
                permalink: "#",
            },
            encryption: {
                padlockMode: PadlockMode.None,
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
                        sender: <button data-testid="sender">tooltip:@alice:example.org</button>,
                    },
                })}
            />,
        );

        expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
            "tooltip:@alice:example.org",
        );
    });

    it("does not render a sender when the sender mode is hidden", () => {
        render(
            <EventTileView
                {...makeProps({
                    content: {
                        sender: undefined,
                    },
                })}
            />,
        );

        expect(screen.queryByTestId("sender")).toBeNull();
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
                        footer: <div className="mx_EventTile_footer">Pinned message</div>,
                    },
                    layout: Layout.Group,
                })}
            />,
        );

        expect(screen.getByText("Pinned message")).toBeInTheDocument();
    });

    it("renders reactions in the footer when provided", () => {
        render(
            <EventTileView
                {...makeProps({
                    content: {
                        footer: (
                            <div className="mx_EventTile_footer">
                                <div data-testid="reactions-row">Reactions</div>
                            </div>
                        ),
                    },
                })}
            />,
        );

        expect(screen.getByTestId("reactions-row")).toBeInTheDocument();
    });

    it("does not render the pinned message badge for file tiles", () => {
        render(
            <EventTileView
                {...makeProps({
                    timelineRenderingType: TimelineRenderingType.File,
                    content: {
                        footer: <div className="mx_EventTile_footer">Pinned message</div>,
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
                            footer: <div className="mx_EventTile_footer">Pinned message</div>,
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
                        displayMode: TimestampDisplayMode.Plain,
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
                        displayMode: TimestampDisplayMode.Linked,
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
                        displayMode: TimestampDisplayMode.Placeholder,
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
                        padlockMode: PadlockMode.Group,
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
                        padlockMode: PadlockMode.Irc,
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
                        toolbar: (
                            <>
                                <button aria-label="View in room" />
                                <button aria-label="Copy link to thread" />
                            </>
                        ),
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
                        toolbar: (
                            <>
                                <button aria-label="View in room" onClick={() => viewInRoom(null)} />
                                <button aria-label="Copy link to thread" onClick={() => copyLinkToThread(null)} />
                            </>
                        ),
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
