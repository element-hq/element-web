/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Avatar } from "@vector-im/compound-web";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchTypeIcon, type SearchResultType } from "./SearchTypeIcon.stories";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultItemType = "People" | "Room" | "Space" | "Message" | "Recent";

interface BaseSearchResultItemProps {
    onClick?: () => void;
}

interface PeopleItemProps extends BaseSearchResultItemProps {
    type: "People";
    name: string;
    userId: string;
    avatarUrl?: string;
}

interface RoomItemProps extends BaseSearchResultItemProps {
    type: "Room";
    name: string;
    roomAddress: string;
    avatarUrl?: string;
}

interface SpaceItemProps extends BaseSearchResultItemProps {
    type: "Space";
    name: string;
    spaceAddress: string;
    avatarUrl?: string;
}

interface MessageItemProps extends BaseSearchResultItemProps {
    type: "Message";
    label: string;
}

interface RecentItemProps extends BaseSearchResultItemProps {
    type: "Recent";
    label: string;
}

type SearchResultItemProps =
    | PeopleItemProps
    | RoomItemProps
    | SpaceItemProps
    | MessageItemProps
    | RecentItemProps;

// ── Shared row wrapper ────────────────────────────────────────────────────────

function ResultRow({
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
                padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                cursor: "pointer",
                borderRadius: "8px",
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

function ResultDetails({
    primary,
    secondary,
}: {
    primary: string;
    secondary?: string;
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
                {primary}
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

export function SearchResultItem(props: SearchResultItemProps): React.JSX.Element {
    if (props.type === "People") {
        return (
            <ResultRow onClick={props.onClick}>
                <Avatar
                    id={props.userId}
                    name={props.name}
                    src={props.avatarUrl}
                    size="32px"
                    type="round"
                />
                <ResultDetails primary={props.name} secondary={props.userId} />
            </ResultRow>
        );
    }

    if (props.type === "Room") {
        return (
            <ResultRow onClick={props.onClick}>
                <Avatar
                    id={props.roomAddress}
                    name={props.name}
                    src={props.avatarUrl}
                    size="32px"
                    type="square"
                />
                <ResultDetails primary={props.name} secondary={props.roomAddress} />
            </ResultRow>
        );
    }

    if (props.type === "Space") {
        return (
            <ResultRow onClick={props.onClick}>
                <Avatar
                    id={props.spaceAddress}
                    name={props.name}
                    src={props.avatarUrl}
                    size="32px"
                    type="square"
                />
                <ResultDetails primary={props.name} secondary={props.spaceAddress} />
            </ResultRow>
        );
    }

    // Message & Recent use the SearchTypeIcon
    const iconType: SearchResultType = props.type === "Message" ? "Message" : "Recent";
    return (
        <ResultRow onClick={props.onClick}>
            <SearchTypeIcon type={iconType} />
            <ResultDetails primary={props.label} />
        </ResultRow>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/SearchResultItem",
    component: SearchResultItem,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
} satisfies Meta<typeof SearchResultItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PersonResult: Story = {
    args: {
        type: "People",
        name: "Malo Jaffré",
        userId: "@malo:element.io",
    },
    name: "People",
};

export const RoomResult: Story = {
    args: {
        type: "Room",
        name: "Marketing",
        roomAddress: "marketing:element.io",
    },
    name: "Room",
};

export const SpaceResult: Story = {
    args: {
        type: "Space",
        name: "Marketing Department",
        spaceAddress: "#marketing:element.io",
    },
    name: "Space",
};

export const MessageResult: Story = {
    args: {
        type: "Message",
        label: 'See messages for \u201cdesign review\u201d',
    },
    name: "Message (CTA)",
};

export const RecentResult: Story = {
    args: {
        type: "Recent",
        label: "design review",
    },
    name: "Recent search",
};

export const AllTypes: Story = {
    render: () => (
        <div
            style={{
                background: "var(--cpd-color-bg-canvas-default)",
                borderRadius: "8px",
                border: "1px solid var(--cpd-color-border-disabled)",
                minWidth: "360px",
                padding: "var(--cpd-space-2x) 0",
            }}
        >
            <SearchResultItem type="People" name="Malo Jaffré" userId="@malo:element.io" />
            <SearchResultItem type="Room" name="Marketing" roomAddress="marketing:element.io" />
            <SearchResultItem type="Space" name="Marketing Department" spaceAddress="#marketing:element.io" />
            <SearchResultItem type="Message" label={'See messages for \u201cdesign review\u201d'} />
            <SearchResultItem type="Recent" label="design review" />
        </div>
    ),
    name: "All types",
};
