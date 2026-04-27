/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { GlobalSearchField } from "./GlobalSearchField.stories";
import { ChatFilterBar, type SearchFilter } from "./ChatFilterChip.stories";
import { SearchSectionHeader } from "./SearchSectionHeader.stories";
import { SearchResultCard } from "./SearchResultCard.stories";

// ── Full-view layout ──────────────────────────────────────────────────────────

export interface GlobalSearchFullViewProps {
    query?: string;
    activeFilter?: SearchFilter;
    onFilterChange?: (filter: SearchFilter) => void;
    onQueryChange?: (query: string) => void;
}

/** Simulated results data */
const PEOPLE_RESULTS = [
    { name: "Malo Jaffré", userId: "@malo:element.io" },
    { name: "Maeva Dupont", userId: "@maeva:element.io" },
    { name: "Malika Osei", userId: "@malika:element.io" },
];

const ROOM_RESULTS = [
    { name: "Marketing", roomAddress: "marketing:element.io" },
    { name: "Marketing All-Hands", roomAddress: "marketing-all-hands:element.io" },
    { name: "Product & Marketing sync", roomAddress: "pm-sync:element.io" },
];

const MESSAGE_RESULTS = [
    { roomName: "Design", senderName: "Malo", messagePreview: "The design for the new landing page looks great" },
    { roomName: "Marketing", senderName: "Maeva", messagePreview: "Can we revisit the marketing brief before launch?" },
    { roomName: "All Hands", senderName: "Malika", messagePreview: "Please review the marketing assets by Friday" },
];

const SPACE_RESULTS = [
    { name: "Marketing Department", spaceAddress: "#marketing:element.io" },
    { name: "Design & Marketing", spaceAddress: "#design-mkt:element.io" },
];

export function GlobalSearchFullView({
    query = "marketing",
    activeFilter = "All",
    onFilterChange,
    onQueryChange,
}: GlobalSearchFullViewProps): React.JSX.Element {
    const showPeople = activeFilter === "All" || activeFilter === "People";
    const showRooms = activeFilter === "All" || activeFilter === "Rooms";
    const showMessages = activeFilter === "All" || activeFilter === "Messages";
    const showSpaces = activeFilter === "All" || activeFilter === "Spaces";

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                background: "var(--cpd-color-bg-canvas-default)",
                overflow: "hidden",
            }}
        >
            {/* Top bar: search field */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                    gap: "var(--cpd-space-3x)",
                }}
            >
                <GlobalSearchField
                    value={query}
                    onChange={onQueryChange}
                    onClear={() => onQueryChange?.("")}
                />
            </div>

            {/* Filter tab bar */}
            <div
                style={{
                    padding: "var(--cpd-space-2x) var(--cpd-space-4x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                }}
            >
                <ChatFilterBar active={activeFilter} onChange={onFilterChange} />
            </div>

            {/* Scrollable results */}
            <div
                role="listbox"
                aria-label="Search results"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "var(--cpd-space-3x)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--cpd-space-3x)",
                }}
            >
                {/* People section */}
                {showPeople && (
                    <section aria-label="People" style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-3x)" }}>
                        <SearchSectionHeader type="People" />
                        {PEOPLE_RESULTS.map((p) => (
                            <SearchResultCard
                                key={p.userId}
                                type="People"
                                name={p.name}
                                userId={p.userId}
                                highlight={query}
                                actionLabel="Message"
                            />
                        ))}
                    </section>
                )}

                {/* Rooms section */}
                {showRooms && (
                    <section aria-label="Rooms" style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-3x)" }}>
                        <SearchSectionHeader type="Rooms" />
                        {ROOM_RESULTS.map((r) => (
                            <SearchResultCard
                                key={r.roomAddress}
                                type="Room"
                                name={r.name}
                                roomAddress={r.roomAddress}
                                highlight={query}
                                actionLabel="Open"
                            />
                        ))}
                    </section>
                )}

                {/* Messages section */}
                {showMessages && (
                    <section aria-label="Messages" style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-3x)" }}>
                        <SearchSectionHeader type="Rooms" />
                        {MESSAGE_RESULTS.map((m) => (
                            <SearchResultCard
                                key={m.roomName + m.senderName}
                                type="Message"
                                roomName={m.roomName}
                                senderName={m.senderName}
                                messagePreview={m.messagePreview}
                                highlight={query}
                                actionLabel="Jump to"
                            />
                        ))}
                    </section>
                )}

                {/* Spaces section */}
                {showSpaces && (
                    <section aria-label="Spaces" style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-3x)" }}>
                        <SearchSectionHeader type="Spaces" />
                        {SPACE_RESULTS.map((s) => (
                            <SearchResultCard
                                key={s.spaceAddress}
                                type="Space"
                                name={s.name}
                                spaceAddress={s.spaceAddress}
                                highlight={query}
                                actionLabel="View"
                            />
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
}

// ── Interactive wrapper ───────────────────────────────────────────────────────

function InteractiveFullView(): React.JSX.Element {
    const [query, setQuery] = useState("marketing");
    const [filter, setFilter] = useState<SearchFilter>("All");

    return (
        <div style={{ width: "760px", height: "600px", border: "1px solid var(--cpd-color-border-disabled)", borderRadius: "12px", overflow: "hidden" }}>
            <GlobalSearchFullView
                query={query}
                activeFilter={filter}
                onFilterChange={setFilter}
                onQueryChange={setQuery}
            />
        </div>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/GlobalSearchFullView",
    component: GlobalSearchFullView,
    tags: ["!autodocs"],
    parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GlobalSearchFullView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllFilter: Story = {
    args: { query: "marketing", activeFilter: "All" },
    name: "All filter",
};

export const PeopleFilter: Story = {
    args: { query: "marketing", activeFilter: "People" },
    name: "People filter",
};

export const RoomsFilter: Story = {
    args: { query: "marketing", activeFilter: "Rooms" },
    name: "Rooms filter",
};

export const MessagesFilter: Story = {
    args: { query: "marketing", activeFilter: "Messages" },
    name: "Messages filter",
};

export const SpacesFilter: Story = {
    args: { query: "marketing", activeFilter: "Spaces" },
    name: "Spaces filter",
};

export const Interactive: Story = {
    render: () => <InteractiveFullView />,
    name: "Interactive",
    parameters: { layout: "centered" },
};
