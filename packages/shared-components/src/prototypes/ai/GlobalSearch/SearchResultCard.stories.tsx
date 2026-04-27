/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Avatar } from "@vector-im/compound-web";
import type { Meta, StoryObj } from "@storybook/react-vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultCardType = "People" | "Room" | "Space" | "Message";

interface BaseCardProps {
    onClick?: () => void;
}

interface PeopleCardProps extends BaseCardProps {
    type: "People";
    name: string;
    userId: string;
    avatarUrl?: string;
    /** Highlighted substring within name */
    highlight?: string;
}

interface RoomCardProps extends BaseCardProps {
    type: "Room";
    name: string;
    roomAddress: string;
    avatarUrl?: string;
    highlight?: string;
}

interface SpaceCardProps extends BaseCardProps {
    type: "Space";
    name: string;
    spaceAddress: string;
    avatarUrl?: string;
    highlight?: string;
}

interface MessageCardProps extends BaseCardProps {
    type: "Message";
    roomName: string;
    senderName: string;
    messagePreview: string;
    timestamp?: string;
    avatarUrl?: string;
    highlight?: string;
}

type SearchResultCardProps = PeopleCardProps | RoomCardProps | SpaceCardProps | MessageCardProps;

// ── Highlight helper ──────────────────────────────────────────────────────────

function HighlightedText({ text, highlight }: { text: string; highlight?: string }): React.JSX.Element {
    if (!highlight) return <>{text}</>;

    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return <>{text}</>;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + highlight.length);
    const after = text.slice(idx + highlight.length);

    return (
        <>
            {before}
            <mark
                style={{
                    background: "var(--cpd-color-bg-accent-subtle)",
                    color: "var(--cpd-color-text-accent)",
                    borderRadius: "2px",
                    padding: "0 1px",
                }}
            >
                {match}
            </mark>
            {after}
        </>
    );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function CardWrapper({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick?: () => void;
}): React.JSX.Element {
    return (
        <div
            role="option"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick?.()}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                cursor: "pointer",
                borderRadius: "8px",
                border: "1px solid var(--cpd-color-border-interactive-secondary)",
                transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                    "var(--cpd-color-bg-subtle-secondary)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
            }}
        >
            {children}
        </div>
    );
}

function CardDetails({
    primary,
    secondary,
    highlight,
}: {
    primary: string;
    secondary?: string;
    highlight?: string;
}): React.JSX.Element {
    return (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span
                style={{
                    font: "var(--cpd-font-body-md-semibold)",
                    color: "var(--cpd-color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                <HighlightedText text={primary} highlight={highlight} />
            </span>
            {secondary && (
                <span
                    style={{
                        font: "var(--cpd-font-body-sm-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {secondary}
                </span>
            )}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchResultCard(props: SearchResultCardProps): React.JSX.Element {
    if (props.type === "People") {
        return (
            <CardWrapper onClick={props.onClick}>
                <Avatar id={props.userId || props.name} name={props.name} src={props.avatarUrl} size="36px" type="round" />
                <CardDetails primary={props.name} secondary={props.userId} highlight={props.highlight} />
            </CardWrapper>
        );
    }

    if (props.type === "Room") {
        return (
            <CardWrapper onClick={props.onClick}>
                <Avatar id={props.roomAddress || props.name} name={props.name} src={props.avatarUrl} size="36px" type="round" />
                <CardDetails primary={props.name} secondary={props.roomAddress} highlight={props.highlight} />
            </CardWrapper>
        );
    }

    if (props.type === "Space") {
        return (
            <CardWrapper onClick={props.onClick}>
                <Avatar id={props.spaceAddress || props.name} name={props.name} src={props.avatarUrl} size="36px" type="square" />
                <CardDetails primary={props.name} secondary={props.spaceAddress} highlight={props.highlight} />
            </CardWrapper>
        );
    }

    // Message
    return (
        <CardWrapper onClick={props.onClick}>
            <Avatar id={props.roomName || "room"} name={props.roomName || ""} src={props.avatarUrl} size="36px" type="round" />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: "var(--cpd-space-1x)" }}>
                {/* Top row: room name + timestamp */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--cpd-space-2x)", overflow: "hidden" }}>
                    <span
                        style={{
                            font: "var(--cpd-font-body-md-semibold)",
                            color: "var(--cpd-color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {props.roomName}
                    </span>
                    <span
                        style={{
                            font: "var(--cpd-font-body-sm-regular)",
                            color: "var(--cpd-color-text-secondary)",
                            flexShrink: 0,
                        }}
                    >
                        {props.timestamp ?? new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "")}
                    </span>
                </div>
                {/* Bottom row: sender + message preview */}
                <span
                    style={{
                        font: "var(--cpd-font-body-sm-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    <span style={{ color: "var(--cpd-color-text-secondary)", fontWeight: "var(--cpd-font-weight-semibold)" }}>{props.senderName}: </span>
                    <HighlightedText text={props.messagePreview} highlight={props.highlight} />
                </span>
            </div>
        </CardWrapper>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/SearchResultCard",
    component: SearchResultCard,
    tags: ["!autodocs"],
    parameters: {
        layout: "padded",
    },
} satisfies Meta<typeof SearchResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PersonCard: Story = {
    args: { type: "People", name: "Malo Jaffré", userId: "@malo:element.io" },
    name: "People",
};

export const PersonCardHighlight: Story = {
    args: { type: "People", name: "Malo Jaffré", userId: "@malo:element.io", highlight: "Malo" },
    name: "People — with highlight",
};

export const RoomCard: Story = {
    args: { type: "Room", name: "Marketing", roomAddress: "marketing:element.io" },
    name: "Room",
};

export const RoomCardHighlight: Story = {
    args: { type: "Room", name: "Marketing", roomAddress: "marketing:element.io", highlight: "Mar" },
    name: "Room — with highlight",
};

export const SpaceCard: Story = {
    args: { type: "Space", name: "Marketing Department", spaceAddress: "#marketing:element.io" },
    name: "Space",
};

export const MessageCard: Story = {
    args: {
        type: "Message",
        roomName: "Design",
        senderName: "Brenda",
        messagePreview: "This is a message that this user wrote at this particular time",
        timestamp: new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", ""),
    },
    name: "Message",
};

export const MessageCardHighlight: Story = {
    args: {
        type: "Message",
        roomName: "Design",
        senderName: "Malo",
        messagePreview: "This is the message with the term being looked at",
        highlight: "term",
        timestamp: new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", ""),
    },
    name: "Message — with highlight",
};

export const AllCards: Story = {
    render: () => (
        <div
            style={{
                background: "var(--cpd-color-bg-canvas-default)",
                borderRadius: "8px",
                border: "1px solid var(--cpd-color-border-disabled)",
                minWidth: "480px",
                padding: "var(--cpd-space-2x) 0",
            }}
        >
            <SearchResultCard type="People" name="Malo Jaffré" userId="@malo:element.io" highlight="Malo" />
            <SearchResultCard type="Room" name="Marketing" roomAddress="marketing:element.io" highlight="Mar" />
            <SearchResultCard type="Space" name="Marketing Department" spaceAddress="#marketing:element.io" />
            <SearchResultCard
                type="Message"
                roomName="Design"
                senderName="Malo"
                messagePreview="This is the message with the term being looked at"
                highlight="term"
                timestamp={new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "")}
            />
        </div>
    ),
    name: "All cards",
};
