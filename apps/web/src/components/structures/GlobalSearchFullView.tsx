/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { createPortal } from "react-dom";

import { GlobalSearchFilter } from "../../hooks/useGlobalSearch";

// ── Filter chip ───────────────────────────────────────────────────────────────

const FULL_VIEW_FILTERS = [
    GlobalSearchFilter.All,
    GlobalSearchFilter.People,
    GlobalSearchFilter.Rooms,
    GlobalSearchFilter.Messages,
    GlobalSearchFilter.Spaces,
] as const;

interface FilterChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "28px",
                padding: "0 12px",
                border: active
                    ? "1px solid var(--cpd-color-border-interactive-primary)"
                    : "1px solid var(--cpd-color-border-interactive-secondary)",
                borderRadius: "var(--cpd-radius-pill-effect)",
                background: active ? "var(--cpd-color-bg-action-primary-rest)" : "transparent",
                color: active ? "var(--cpd-color-text-on-solid-primary)" : "var(--cpd-color-text-secondary)",
                font: "var(--cpd-font-body-sm-medium)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
            }}
        >
            {label}
        </button>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoResultsEmptyState({ query }: { query: string }): JSX.Element {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: "var(--cpd-space-4x)",
                padding: "var(--cpd-space-8x)",
                textAlign: "center",
            }}
        >
            {/* Search icon in rounded square */}
            <div
                aria-hidden="true"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "var(--cpd-color-bg-subtle-secondary)",
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--cpd-color-icon-secondary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-2x)" }}>
                <span
                    style={{
                        font: "var(--cpd-font-heading-md-semibold)",
                        color: "var(--cpd-color-text-primary)",
                    }}
                >
                    No results
                </span>
                <span
                    style={{
                        font: "var(--cpd-font-body-md-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        maxWidth: "320px",
                    }}
                >
                    {query
                        ? `There are no results for "${query}." Try a new search term.`
                        : "Start typing to search."}
                </span>
            </div>
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchFullViewProps {
    query: string;
    activeFilter: GlobalSearchFilter;
    onFilterChange: (filter: GlobalSearchFilter) => void;
    onCollapseToDropdown: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

function GlobalSearchFullViewInner({
    query,
    activeFilter,
    onFilterChange,
    onCollapseToDropdown,
}: GlobalSearchFullViewProps): JSX.Element {
    return (
        <div
            role="dialog"
            aria-label="Global search"
            style={{
                position: "fixed",
                top: "52px", // TopBar height
                left: "69px", // collapsed SpacePanel width (68px) + 1px border
                right: 0,
                bottom: 0,
                zIndex: 900,
                display: "flex",
                flexDirection: "column",
                background: "var(--cpd-color-bg-canvas-default)",
            }}
        >
            {/* Filter pill bar — centred below TopBar */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                }}
            >
                <div
                    role="tablist"
                    aria-label="Search filters"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--cpd-space-2x)",
                    }}
                >
                    {FULL_VIEW_FILTERS.map((filter) => (
                        <FilterChip
                            key={filter}
                            label={filter}
                            active={activeFilter === filter}
                            onClick={() => onFilterChange(filter)}
                        />
                    ))}
                </div>
            </div>

            {/* Content area — always empty state for now (phase 1) */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <NoResultsEmptyState query={query} />
            </div>

            {/* Invisible backdrop click to collapse */}
            <button
                type="button"
                aria-label="Close search"
                onClick={onCollapseToDropdown}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "none",
                    border: "none",
                    cursor: "default",
                    zIndex: -1,
                }}
            />
        </div>
    );
}

export function GlobalSearchFullView(props: GlobalSearchFullViewProps): JSX.Element {
    return createPortal(<GlobalSearchFullViewInner {...props} />, document.body);
}
