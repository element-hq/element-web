/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChatFilterBar, type SearchFilter } from "./ChatFilterChip.stories";
import { GlobalSearchField } from "./GlobalSearchField.stories";
import { SearchSectionHeader } from "./SearchSectionHeader.stories";
import { SearchResultItem } from "./SearchResultItem.stories";

// ── "View all results" CTA ────────────────────────────────────────────────────

function ViewAllResults({ onClick }: { onClick?: () => void }): React.JSX.Element {
    return (
        <div
            style={{
                borderTop: "1px solid var(--cpd-color-border-disabled)",
                padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                marginTop: "var(--cpd-space-1x)",
            }}
        >
            <button
                onClick={onClick}
                style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    font: "var(--cpd-font-body-sm-semibold)",
                    color: "var(--cpd-color-text-accent)",
                    textAlign: "center",
                    padding: "var(--cpd-space-2x) 0",
                    borderRadius: "6px",
                    transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--cpd-color-bg-subtle-secondary)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
            >
                View all results
            </button>
        </div>
    );
}

// ── Dropdown panel ────────────────────────────────────────────────────────────

const DROPDOWN_FILTERS: SearchFilter[] = ["People", "Rooms", "Messages", "Spaces"];

export interface GlobalSearchDropdownProps {
    query?: string;
    activeFilter?: SearchFilter;
    onFilterChange?: (filter: SearchFilter) => void;
    onViewAll?: () => void;
}

export function GlobalSearchDropdown({
    query = "",
    activeFilter = "People",
    onFilterChange,
    onViewAll,
}: GlobalSearchDropdownProps): React.JSX.Element {
    const hasQuery = query.trim().length > 0;

    return (
        <div
            role="listbox"
            aria-label="Search results"
            style={{
                background: "var(--cpd-color-bg-canvas-default)",
                border: "1px solid var(--cpd-color-border-disabled)",
                borderRadius: "12px",
                boxShadow:
                    "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
                width: "480px",
                overflow: "hidden",
            }}
        >
            {/* Filter chip bar */}
            <div
                style={{
                    padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                }}
            >
                <ChatFilterBar
                    filters={DROPDOWN_FILTERS}
                    active={activeFilter}
                    onChange={onFilterChange}
                />
            </div>

            {/* Recent searches (no query) */}
            {!hasQuery && (
                <div>
                    <SearchSectionHeader type="Suggestions" />
                    <SearchResultItem type="Recent" label="design review" />
                    <SearchResultItem type="Recent" label="product roadmap" />
                    <SearchResultItem type="Recent" label="onboarding" />
                </div>
            )}

            {/* Results with query */}
            {hasQuery && (
                <div>
                    {/* People */}
                    <SearchSectionHeader type="People" />
                    <SearchResultItem type="People" name="Malo Jaffré" userId="@malo:element.io" />
                    <SearchResultItem type="People" name="Maeva" userId="@maeva:element.io" />

                    {/* Rooms */}
                    <SearchSectionHeader type="Rooms" />
                    <SearchResultItem type="Room" name="Marketing" roomAddress="marketing:element.io" />
                    <SearchResultItem type="Room" name="Marketing All-Hands" roomAddress="marketing-all-hands:element.io" />

                    {/* Messages CTA */}
                    <SearchResultItem type="Message" label={`See messages for "${query}"`} />
                </div>
            )}

            {/* View all CTA */}
            {hasQuery && <ViewAllResults onClick={onViewAll} />}
        </div>
    );
}

// ── Composed field + dropdown ─────────────────────────────────────────────────

function GlobalSearchComposed(): React.JSX.Element {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<SearchFilter>("People");

    return (
        <div style={{ position: "relative", width: "480px" }}>
            <GlobalSearchField
                value={query}
                onChange={(v) => {
                    setQuery(v);
                    setOpen(true);
                }}
                onClear={() => {
                    setQuery("");
                    setOpen(false);
                }}
            />
            {open && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 100 }}>
                    <GlobalSearchDropdown
                        query={query}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onViewAll={() => alert("Navigate to full search view")}
                    />
                </div>
            )}
        </div>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/GlobalSearchDropdown",
    component: GlobalSearchDropdown,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
} satisfies Meta<typeof GlobalSearchDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
    args: { query: "" },
    name: "Empty (recent suggestions)",
};

export const WithQuery: Story = {
    args: { query: "Malo" },
    name: "With query",
};

export const FullComposed: Story = {
    render: () => <GlobalSearchComposed />,
    name: "Composed: field + dropdown",
    parameters: { layout: "centered" },
};
