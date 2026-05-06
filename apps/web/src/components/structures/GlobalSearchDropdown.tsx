/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room, RoomType } from "matrix-js-sdk/src/matrix";

import { HistoryIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { GlobalSearchFilter, type PersonResult, useGlobalSearch } from "../../hooks/useGlobalSearch";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import DMRoomMap from "../../utils/DMRoomMap";
import RoomAvatar from "../views/avatars/RoomAvatar";
import MemberAvatar from "../views/avatars/MemberAvatar";

// ── Filter chip ───────────────────────────────────────────────────────────────

const DROPDOWN_FILTERS = [
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

// ── People avatar pill ────────────────────────────────────────────────────────

function PersonPill({ room, onClick }: { room: Room; onClick?: () => void }): JSX.Element {
    const dmMap = DMRoomMap.shared();
    const userId = dmMap.getUserIdForRoomId(room.roomId);
    const member = userId ? room.getMember(userId) : null;
    const displayName = member?.rawDisplayName ?? room.name ?? "Unknown";

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--cpd-space-1x)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "var(--cpd-space-1x)",
                borderRadius: "8px",
                minWidth: "56px",
                maxWidth: "72px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
            <RoomAvatar room={room} size="40px" />
            <span
                style={{
                    font: "var(--cpd-font-body-xs-regular)",
                    color: "var(--cpd-color-text-primary)",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                }}
            >
                {displayName}
            </span>
        </button>
    );
}

// ── Suggestion row ────────────────────────────────────────────────────────────

function SuggestionRow({ room, onClick }: { room: Room; onClick?: () => void }): JSX.Element {
    const isSpace = room.getType() === RoomType.Space;
    const address = room.getCanonicalAlias() ?? room.roomId;

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                width: "100%",
                padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
            <RoomAvatar room={room} size="32px" />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ font: "var(--cpd-font-body-md-medium)", color: "var(--cpd-color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {room.name}
                </span>
                <span style={{ font: "var(--cpd-font-body-sm-regular)", color: "var(--cpd-color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isSpace ? address : address}
                </span>
            </div>
        </button>
    );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }): JSX.Element {
    return (
        <div style={{ padding: "var(--cpd-space-1x) var(--cpd-space-3x)", marginTop: "var(--cpd-space-1x)" }}>
            <span style={{ font: "var(--cpd-font-body-xs-semibold)", color: "var(--cpd-color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
            </span>
        </div>
    );
}

// ── Search result row ─────────────────────────────────────────────────────────

function PersonResultRow({ result, onClick }: { result: PersonResult; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-3x)",
                width: "100%",
                padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
            {result.member instanceof Object && "getMxcAvatarUrl" in result.member ? (
                <MemberAvatar member={result.member as any} size="32px" />
            ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cpd-color-bg-subtle-secondary)", flexShrink: 0 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ font: "var(--cpd-font-body-md-medium)", color: "var(--cpd-color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.name}
                </span>
                <span style={{ font: "var(--cpd-font-body-sm-regular)", color: "var(--cpd-color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.userId}
                </span>
            </div>
        </button>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchDropdownProps {
    query: string;
    activeFilter: GlobalSearchFilter;
    recentSearches: Room[];
    onFilterChange: (filter: GlobalSearchFilter) => void;
    onExpandToFullView: () => void;
    onRoomClick: (roomId: string) => void;
    onPersonClick: (result: PersonResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearchDropdown({
    query,
    activeFilter,
    recentSearches,
    onFilterChange,
    onExpandToFullView,
    onRoomClick,
    onPersonClick,
}: GlobalSearchDropdownProps): JSX.Element {
    const hasQuery = query.trim().length > 0;
    const dmMap = DMRoomMap.shared();

    // Recently viewed DM rooms (from BreadcrumbsStore = rooms the user actually opened)
    const recentPeople = BreadcrumbsStore.instance.rooms.filter((r) => dmMap.getUserIdForRoomId(r.roomId));

    // Recent suggestions: non-DM rooms from recentSearches, up to 4
    const recentSuggestions = recentSearches.filter((r) => !dmMap.getUserIdForRoomId(r.roomId)).slice(0, 4);

    // If there aren't enough non-DM items, pad suggestions with DM rooms too (up to 4 total)
    const suggestions = recentSuggestions.length < 4
        ? [...recentSuggestions, ...recentPeople.slice(0, 4 - recentSuggestions.length)]
        : recentSuggestions;

    // Search results (only active when query is non-empty)
    const searchResults = useGlobalSearch({ query, filter: activeFilter });

    return (
        <div
            role="dialog"
            aria-label="Search"
            style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                width: "480px",
                background: "var(--cpd-color-bg-canvas-default)",
                border: "1px solid var(--cpd-color-border-disabled)",
                borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
                overflow: "hidden",
                zIndex: 1000,
            }}
        >
            {/* Filter chips */}
            <div
                role="tablist"
                aria-label="Search filters"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cpd-space-2x)",
                    padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                    borderBottom: "1px solid var(--cpd-color-border-disabled)",
                    overflowX: "auto",
                }}
            >
                {DROPDOWN_FILTERS.map((filter) => (
                    <FilterChip
                        key={filter}
                        label={filter}
                        active={activeFilter === filter}
                        onClick={() => onFilterChange(filter)}
                    />
                ))}
            </div>

            {/* Default state (no query) */}
            {!hasQuery && (
                <>
                    {/* Recent people row */}
                    {recentPeople.length > 0 && (
                        <div>
                            <SectionHeader label="People" />
                            <div
                                style={{
                                    display: "flex",
                                    gap: "var(--cpd-space-2x)",
                                    padding: "var(--cpd-space-2x) var(--cpd-space-3x) var(--cpd-space-3x)",
                                    overflowX: "auto",
                                }}
                            >
                                {recentPeople.map((room) => (
                                    <PersonPill key={room.roomId} room={room} onClick={() => onRoomClick(room.roomId)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div style={{ borderTop: recentPeople.length > 0 ? "1px solid var(--cpd-color-border-disabled)" : undefined }}>
                            <SectionHeader label="Suggestions" />
                            {suggestions.map((room) => (
                                <SuggestionRow key={room.roomId} room={room} onClick={() => onRoomClick(room.roomId)} />
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {recentPeople.length === 0 && suggestions.length === 0 && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--cpd-space-2x)",
                                padding: "var(--cpd-space-4x) var(--cpd-space-3x)",
                                color: "var(--cpd-color-text-secondary)",
                            }}
                        >
                            <HistoryIcon width={16} height={16} />
                            <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>No recent search to show</span>
                        </div>
                    )}
                </>
            )}

            {/* With query: grouped search results */}
            {hasQuery && (
                <div>
                    {/* People */}
                    {searchResults.people.length > 0 && (
                        <div>
                            <SectionHeader label="People" />
                            {searchResults.people.slice(0, 3).map((result) => (
                                <PersonResultRow
                                    key={result.userId}
                                    result={result}
                                    onClick={() => onPersonClick(result)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Rooms */}
                    {searchResults.rooms.length > 0 && (
                        <div style={{ borderTop: searchResults.people.length > 0 ? "1px solid var(--cpd-color-border-disabled)" : undefined }}>
                            <SectionHeader label="Rooms" />
                            {searchResults.rooms.slice(0, 3).map((result) => (
                                <SuggestionRow
                                    key={result.roomId}
                                    room={result.room}
                                    onClick={() => onRoomClick(result.roomId)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Spaces */}
                    {searchResults.spaces.length > 0 && (
                        <div style={{ borderTop: (searchResults.people.length > 0 || searchResults.rooms.length > 0) ? "1px solid var(--cpd-color-border-disabled)" : undefined }}>
                            <SectionHeader label="Spaces" />
                            {searchResults.spaces.slice(0, 3).map((result) => (
                                <SuggestionRow
                                    key={result.roomId}
                                    room={result.room}
                                    onClick={() => onRoomClick(result.roomId)}
                                />
                            ))}
                        </div>
                    )}

                    {/* View all results */}
                    <div style={{ borderTop: "1px solid var(--cpd-color-border-disabled)" }}>
                        <button
                            type="button"
                            onClick={onExpandToFullView}
                            style={{
                                display: "block",
                                width: "100%",
                                padding: "var(--cpd-space-3x)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                font: "var(--cpd-font-body-md-semibold)",
                                color: "var(--cpd-color-text-link)",
                                textAlign: "center",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                            View all results
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
