/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { createPortal } from "react-dom";
import { Link } from "@vector-im/compound-web";
import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import {
    GlobalSearchFilter,
    type PersonResult,
    type RoomResult,
    type SpaceResult,
    useGlobalSearch,
} from "../../hooks/useGlobalSearch";
import { useMessageSearch, type MessageSearchResult } from "../../hooks/useMessageSearch";
import RoomAvatar from "../views/avatars/RoomAvatar";
import MemberAvatar from "../views/avatars/MemberAvatar";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CATEGORY_RESULTS = 8;

const FULL_VIEW_FILTERS = [
    GlobalSearchFilter.All,
    GlobalSearchFilter.People,
    GlobalSearchFilter.Rooms,
    GlobalSearchFilter.Messages,
    GlobalSearchFilter.Spaces,
    GlobalSearchFilter.Files,
] as const;

// ── Filter chip ───────────────────────────────────────────────────────────────

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

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): JSX.Element {
    return (
        <h2
            style={{
                font: "var(--cpd-font-body-lg-semibold)",
                color: "var(--cpd-color-text-primary)",
                margin: 0,
                padding: "var(--cpd-space-6x) 0 var(--cpd-space-3x)",
            }}
        >
            {title}
        </h2>
    );
}

// ── Person card ───────────────────────────────────────────────────────────────

function PersonCard({ result, onClick }: { result: PersonResult; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                width: "100%",
                padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                border: "1px solid var(--cpd-color-border-disabled)",
                borderRadius: "12px",
                background: "var(--cpd-color-bg-canvas-default)",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--cpd-color-bg-action-secondary-hovered)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-canvas-default)";
            }}
        >
            <MemberAvatar member={result.member} size="36px" hideTitle />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <span
                    style={{
                        font: "var(--cpd-font-body-md-semibold)",
                        color: "var(--cpd-color-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {result.name}
                </span>
                <span
                    style={{
                        font: "var(--cpd-font-body-sm-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {result.userId}
                </span>
            </div>
        </button>
    );
}

// ── Room / Space card ─────────────────────────────────────────────────────────

function RoomCard({ result, onClick }: { result: RoomResult | SpaceResult; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                width: "100%",
                padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                border: "1px solid var(--cpd-color-border-disabled)",
                borderRadius: "12px",
                background: "var(--cpd-color-bg-canvas-default)",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--cpd-color-bg-action-secondary-hovered)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-canvas-default)";
            }}
        >
            <RoomAvatar room={result.room} size="36px" />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <span
                    style={{
                        font: "var(--cpd-font-body-md-semibold)",
                        color: "var(--cpd-color-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {result.name}
                </span>
                {result.address && (
                    <span
                        style={{
                            font: "var(--cpd-font-body-sm-regular)",
                            color: "var(--cpd-color-text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {result.address}
                    </span>
                )}
            </div>
        </button>
    );
}

// ── Message date formatter ────────────────────────────────────────────────────

function formatMessageDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ── Message result card ───────────────────────────────────────────────────────

function MessageResultCard({
    result,
    onClick,
}: {
    result: MessageSearchResult;
    onClick: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                width: "100%",
                padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                border: "1px solid var(--cpd-color-border-disabled)",
                borderRadius: "12px",
                background: "var(--cpd-color-bg-canvas-default)",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--cpd-color-bg-action-secondary-hovered)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-canvas-default)";
            }}
        >
            <div style={{ flexShrink: 0 }}>
                {result.member ? (
                    <MemberAvatar member={result.member} size="40px" hideTitle />
                ) : (
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "var(--cpd-color-bg-subtle-secondary)",
                        }}
                    />
                )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)" }}>
                    <span
                        style={{
                            font: "var(--cpd-font-body-md-regular)",
                            color: "var(--cpd-color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                        }}
                    >
                        {result.senderName}
                    </span>
                    <span
                        style={{
                            font: "var(--cpd-font-body-sm-regular)",
                            color: "var(--cpd-color-text-secondary)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                        }}
                    >
                        {formatMessageDate(result.timestamp)}
                    </span>
                </div>
                <span
                    style={{
                        font: "var(--cpd-font-body-md-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {result.body}
                </span>
            </div>
        </button>
    );
}

// ── Message sub-filters ───────────────────────────────────────────────────────

const MESSAGE_SUB_FILTERS = ["Type", "Date", "Person"] as const;

function MessageSubFilters(): JSX.Element {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-1x)" }}>
            {MESSAGE_SUB_FILTERS.map((label) => (
                <button
                    key={label}
                    type="button"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: "28px",
                        padding: "0 var(--cpd-space-2x)",
                        border: "none",
                        borderRadius: "var(--cpd-radius-pill-effect)",
                        background: "transparent",
                        color: "var(--cpd-color-text-secondary)",
                        font: "var(--cpd-font-body-sm-medium)",
                        cursor: "pointer",
                        gap: "2px",
                    }}
                >
                    {label}
                    <ChevronDownIcon width={20} height={20} style={{ color: "var(--cpd-color-icon-secondary)" }} />
                </button>
            ))}
        </div>
    );
}

// ── Messages results content ──────────────────────────────────────────────────

function MessagesResultsContent({
    query,
    onRoomClick,
}: {
    query: string;
    onRoomClick: (roomId: string) => void;
}): JSX.Element {
    const { results, loading } = useMessageSearch(query);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: "760px",
                width: "100%",
                margin: "0 auto",
                padding: "0 var(--cpd-space-4x) var(--cpd-space-8x)",
            }}
        >
            <div style={{ padding: "var(--cpd-space-3x) 0" }}>
                <MessageSubFilters />
            </div>

            {loading ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "var(--cpd-space-12x)",
                        font: "var(--cpd-font-body-md-regular)",
                        color: "var(--cpd-color-text-secondary)",
                    }}
                >
                    Searching…
                </div>
            ) : results.length > 0 ? (
                <>
                    <h2
                        style={{
                            font: "var(--cpd-font-body-lg-semibold)",
                            color: "var(--cpd-color-text-primary)",
                            margin: 0,
                            padding: "var(--cpd-space-3x) 0 var(--cpd-space-3x)",
                        }}
                    >
                        Results
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-3x)" }}>
                        {results.map((result) => (
                            <MessageResultCard
                                key={result.eventId}
                                result={result}
                                onClick={() => onRoomClick(result.roomId)}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <EmptyState query={query} />
            )}
        </div>
    );
}

// ── Empty / coming-soon state ─────────────────────────────────────────────────

function EmptyState({ query, label }: { query: string; label?: string }): JSX.Element {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: "var(--cpd-space-4x)",
                padding: "var(--cpd-space-12x) var(--cpd-space-8x)",
                textAlign: "center",
            }}
        >
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
                    style={{ font: "var(--cpd-font-heading-md-semibold)", color: "var(--cpd-color-text-primary)" }}
                >
                    {label ?? "No results"}
                </span>
                <span
                    style={{
                        font: "var(--cpd-font-body-md-regular)",
                        color: "var(--cpd-color-text-secondary)",
                        maxWidth: "320px",
                    }}
                >
                    {label
                        ? "This feature is coming soon."
                        : query
                          ? `There are no results for "${query}." Try a new search term.`
                          : "Start typing to search."}
                </span>
            </div>
        </div>
    );
}

// ── "More" text button ────────────────────────────────────────────────────────

function MoreButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
    return (
        <div style={{ marginTop: "16px" }}>
            <Link kind="primary" onClick={onClick}>
                {label}
            </Link>
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchFullViewProps {
    query: string;
    activeFilter: GlobalSearchFilter;
    onFilterChange: (filter: GlobalSearchFilter) => void;
    onCollapseToDropdown: () => void;
    onRoomClick: (roomId: string) => void;
    onPersonClick: (result: PersonResult) => void;
}

// ── Results content ───────────────────────────────────────────────────────────

function ResultsContent({
    query,
    activeFilter,
    onFilterChange,
    onRoomClick,
    onPersonClick,
}: Pick<GlobalSearchFullViewProps, "query" | "activeFilter" | "onFilterChange" | "onRoomClick" | "onPersonClick">): JSX.Element {
    const { people, rooms, spaces } = useGlobalSearch({ query, filter: activeFilter });

    if (activeFilter === GlobalSearchFilter.Messages) {
        return <MessagesResultsContent query={query} onRoomClick={onRoomClick} />;
    }

    if (activeFilter === GlobalSearchFilter.Files) {
        return <EmptyState query="" label="Coming soon" />;
    }

    if (!query.trim()) {
        return <EmptyState query="" />;
    }

    const showPeople = activeFilter === GlobalSearchFilter.All || activeFilter === GlobalSearchFilter.People;
    const showRooms = activeFilter === GlobalSearchFilter.All || activeFilter === GlobalSearchFilter.Rooms;
    const showSpaces = activeFilter === GlobalSearchFilter.All || activeFilter === GlobalSearchFilter.Spaces;

    const hasPeople = showPeople && people.length > 0;
    const hasRooms = showRooms && rooms.length > 0;
    const hasSpaces = showSpaces && spaces.length > 0;

    if (!hasPeople && !hasRooms && !hasSpaces) {
        return <EmptyState query={query} />;
    }

    const isAll = activeFilter === GlobalSearchFilter.All;

    const visiblePeople = isAll ? people.slice(0, MAX_CATEGORY_RESULTS) : people;
    const visibleRooms = isAll ? rooms.slice(0, MAX_CATEGORY_RESULTS) : rooms;
    const visibleSpaces = isAll ? spaces.slice(0, MAX_CATEGORY_RESULTS) : spaces;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: "760px",
                width: "100%",
                margin: "0 auto",
                padding: "0 var(--cpd-space-4x) var(--cpd-space-8x)",
            }}
        >
            {hasPeople && (
                <>
                    <SectionHeader title="People" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-2x)" }}>
                        {visiblePeople.map((p) => (
                            <PersonCard key={p.userId} result={p} onClick={() => onPersonClick(p)} />
                        ))}
                    </div>
                    {isAll && people.length > MAX_CATEGORY_RESULTS && (
                        <MoreButton
                            label="More people"
                            onClick={() => onFilterChange(GlobalSearchFilter.People)}
                        />
                    )}
                </>
            )}

            {hasRooms && (
                <>
                    <SectionHeader title="Rooms" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-2x)" }}>
                        {visibleRooms.map((r) => (
                            <RoomCard key={r.roomId} result={r} onClick={() => onRoomClick(r.roomId)} />
                        ))}
                    </div>
                    {isAll && rooms.length > MAX_CATEGORY_RESULTS && (
                        <MoreButton
                            label="More rooms"
                            onClick={() => onFilterChange(GlobalSearchFilter.Rooms)}
                        />
                    )}
                </>
            )}

            {hasSpaces && (
                <>
                    <SectionHeader title="Spaces" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cpd-space-2x)" }}>
                        {visibleSpaces.map((s) => (
                            <RoomCard key={s.roomId} result={s} onClick={() => onRoomClick(s.roomId)} />
                        ))}
                    </div>
                    {isAll && spaces.length > MAX_CATEGORY_RESULTS && (
                        <MoreButton
                            label="More spaces"
                            onClick={() => onFilterChange(GlobalSearchFilter.Spaces)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

function GlobalSearchFullViewInner({
    query,
    activeFilter,
    onFilterChange,
    onCollapseToDropdown,
    onRoomClick,
    onPersonClick,
}: GlobalSearchFullViewProps): JSX.Element {
    return (
        <div
            role="dialog"
            aria-label="Global search"
            style={{
                position: "fixed",
                top: "52px",
                left: "69px",
                right: 0,
                bottom: 0,
                zIndex: 900,
                display: "flex",
                flexDirection: "column",
                background: "var(--cpd-color-bg-canvas-default)",
            }}
        >
            {/* Filter chip bar */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "var(--cpd-space-3x) var(--cpd-space-4x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                    flexShrink: 0,
                }}
            >
                <div
                    role="tablist"
                    aria-label="Search filters"
                    style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)" }}
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

            {/* Scrollable results */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <ResultsContent
                    query={query}
                    activeFilter={activeFilter}
                    onFilterChange={onFilterChange}
                    onRoomClick={onRoomClick}
                    onPersonClick={onPersonClick}
                />
            </div>

            {/* Invisible backdrop to collapse */}
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
