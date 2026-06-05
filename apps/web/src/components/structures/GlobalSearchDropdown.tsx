/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room, RoomType } from "matrix-js-sdk/src/matrix";

import { FilterIcon, HistoryIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { GlobalSearchFilter, type PersonResult, useGlobalSearch } from "../../hooks/useGlobalSearch";
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
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-action-secondary-hovered)"; }}
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
            <span style={{ font: "var(--cpd-font-body-sm-semibold)", color: "var(--cpd-color-text-secondary)" }}>
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
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-action-secondary-hovered)"; }}
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
    onCommandSelect: (filter: GlobalSearchFilter) => void;
    onExpandToFullView: () => void;
    onRoomClick: (roomId: string) => void;
    onPersonClick: (result: PersonResult) => void;
}

// ── Command row ───────────────────────────────────────────────────────────────

function CommandRow({ filter, onClick }: { filter: GlobalSearchFilter; onClick: () => void }): JSX.Element {
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
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-action-secondary-hovered)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "var(--cpd-color-bg-subtle-secondary)", flexShrink: 0 }}>
                <FilterIcon width={16} height={16} style={{ color: "var(--cpd-color-icon-secondary)" }} />
            </span>
            <span style={{ font: "var(--cpd-font-body-md-regular)", color: "var(--cpd-color-text-primary)" }}>
                is:<strong>{filter}</strong>
            </span>
        </button>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<GlobalSearchFilter, string> = {
    [GlobalSearchFilter.All]: "results",
    [GlobalSearchFilter.People]: "people",
    [GlobalSearchFilter.Rooms]: "rooms",
    [GlobalSearchFilter.Messages]: "messages",
    [GlobalSearchFilter.Spaces]: "spaces",
};

// ── View all CTA ──────────────────────────────────────────────────────────────

function ViewAllButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
    return (
        <div style={{ borderTop: "1px solid var(--cpd-color-border-disabled)" }}>
            <button
                type="button"
                onClick={onClick}
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-action-secondary-hovered)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
                {label}
            </button>
        </div>
    );
}

// ── Search results row (no-results fallback) ──────────────────────────────────

function SearchResultsRow({ query, onClick }: { query: string; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "var(--cpd-space-2x) var(--cpd-space-3x)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-action-secondary-hovered)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
            <span style={{ font: "var(--cpd-font-body-md-regular)", color: "var(--cpd-color-text-secondary)" }}>
                Search results for:{" "}
                <span style={{ color: "var(--cpd-color-text-primary)", fontWeight: 600 }}>{query}</span>
            </span>
            <kbd style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--cpd-color-border-interactive-secondary)",
                background: "var(--cpd-color-bg-subtle-secondary)",
                font: "var(--cpd-font-body-xs-regular)",
                color: "var(--cpd-color-text-secondary)",
                flexShrink: 0,
            }}>
                Enter
            </kbd>
        </button>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearchDropdown({
    query,
    activeFilter,
    recentSearches,
    onFilterChange,
    onCommandSelect,
    onExpandToFullView,
    onRoomClick,
    onPersonClick,
}: GlobalSearchDropdownProps): JSX.Element {
    const hasQuery = query.trim().length > 0;
    const isFilterActive = activeFilter !== GlobalSearchFilter.All;

    // Command mode: user typed "is:" (with colon, any casing) and no filter is active yet
    const isCommandMode = !isFilterActive && query.toLowerCase().startsWith("is:");
    const commandSearch = isCommandMode ? query.slice(3).toLowerCase() : "";
    const matchingCommands = isCommandMode
        ? DROPDOWN_FILTERS.filter((f) => f.toLowerCase().startsWith(commandSearch))
        : [];
    const dmMap = DMRoomMap.shared();

    // Search results (driven by hook; hook respects the active filter)
    const searchResults = useGlobalSearch({ query, filter: activeFilter });

    const hasFilteredResults =
        searchResults.people.length > 0 || searchResults.rooms.length > 0 || searchResults.spaces.length > 0;

    const viewAllLabel = `View all ${FILTER_LABELS[activeFilter]}`;

    return (
        <div
            role="dialog"
            aria-label="Search"
            style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                width: "100%",
                boxSizing: "border-box",
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

            {/* ── Command mode: user typed "is:" — show matching filter commands ── */}
            {isCommandMode && (
                <div>
                    {matchingCommands.length > 0 ? (
                        matchingCommands.map((f) => (
                            <CommandRow key={f} filter={f} onClick={() => onCommandSelect(f)} />
                        ))
                    ) : (
                        <div style={{ padding: "var(--cpd-space-3x)", font: "var(--cpd-font-body-sm-regular)", color: "var(--cpd-color-text-secondary)" }}>
                            No matching filter
                        </div>
                    )}
                </div>
            )}

            {/* ── State 1: No filter, no query — recent searches ── */}
            {!isFilterActive && !hasQuery && !isCommandMode && (
                <>
                    {recentSearches.length > 0 ? (
                        <div>
                            <SectionHeader label="Recent searches" />
                            {recentSearches.slice(0, 6).map((room) => (
                                <SuggestionRow key={room.roomId} room={room} onClick={() => onRoomClick(room.roomId)} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", padding: "var(--cpd-space-4x) var(--cpd-space-3x)", color: "var(--cpd-color-text-secondary)" }}>
                            <HistoryIcon width={16} height={16} />
                            <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>No recent search to show</span>
                        </div>
                    )}
                </>
            )}

            {/* ── State 2: No filter, with query — grouped results ── */}
            {!isFilterActive && hasQuery && !isCommandMode && (
                <div>
                    {searchResults.people.length > 0 && (
                        <div>
                            <SectionHeader label="People" />
                            {searchResults.people.slice(0, 3).map((result) => (
                                <PersonResultRow key={result.userId} result={result} onClick={() => onPersonClick(result)} />
                            ))}
                        </div>
                    )}
                    {searchResults.rooms.length > 0 && (
                        <div style={{ borderTop: searchResults.people.length > 0 ? "1px solid var(--cpd-color-border-disabled)" : undefined }}>
                            <SectionHeader label="Rooms" />
                            {searchResults.rooms.slice(0, 3).map((result) => (
                                <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                            ))}
                        </div>
                    )}
                    {searchResults.spaces.length > 0 && (
                        <div style={{ borderTop: (searchResults.people.length > 0 || searchResults.rooms.length > 0) ? "1px solid var(--cpd-color-border-disabled)" : undefined }}>
                            <SectionHeader label="Spaces" />
                            {searchResults.spaces.slice(0, 3).map((result) => (
                                <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                            ))}
                        </div>
                    )}
                    {!hasFilteredResults && (
                        <SearchResultsRow query={query} onClick={onExpandToFullView} />
                    )}
                    <ViewAllButton label="View all results" onClick={onExpandToFullView} />
                </div>
            )}

            {/* ── State 3: Filter active, no query — scoped suggestions from hook ── */}
            {isFilterActive && !hasQuery && (
                <>
                    {activeFilter === GlobalSearchFilter.People && (
                        searchResults.people.length > 0 ? (
                            <div>
                                <SectionHeader label="Suggestions" />
                                {searchResults.people.slice(0, 6).map((result) => (
                                    <PersonResultRow key={result.userId} result={result} onClick={() => onPersonClick(result)} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", padding: "var(--cpd-space-4x) var(--cpd-space-3x)", color: "var(--cpd-color-text-secondary)" }}>
                                <HistoryIcon width={16} height={16} />
                                <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>No suggestions to show</span>
                            </div>
                        )
                    )}
                    {activeFilter === GlobalSearchFilter.Rooms && (
                        searchResults.rooms.length > 0 ? (
                            <div>
                                <SectionHeader label="Suggestions" />
                                {searchResults.rooms.slice(0, 6).map((result) => (
                                    <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", padding: "var(--cpd-space-4x) var(--cpd-space-3x)", color: "var(--cpd-color-text-secondary)" }}>
                                <HistoryIcon width={16} height={16} />
                                <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>No suggestions to show</span>
                            </div>
                        )
                    )}
                    {activeFilter === GlobalSearchFilter.Spaces && (
                        searchResults.spaces.length > 0 ? (
                            <div>
                                <SectionHeader label="Suggestions" />
                                {searchResults.spaces.slice(0, 6).map((result) => (
                                    <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", padding: "var(--cpd-space-4x) var(--cpd-space-3x)", color: "var(--cpd-color-text-secondary)" }}>
                                <HistoryIcon width={16} height={16} />
                                <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>No suggestions to show</span>
                            </div>
                        )
                    )}
                    {(activeFilter === GlobalSearchFilter.Messages || activeFilter === GlobalSearchFilter.Files) && (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", padding: "var(--cpd-space-4x) var(--cpd-space-3x)", color: "var(--cpd-color-text-secondary)" }}>
                            <HistoryIcon width={16} height={16} />
                            <span style={{ font: "var(--cpd-font-body-sm-regular)" }}>Start typing to search</span>
                        </div>
                    )}
                    <ViewAllButton label={viewAllLabel} onClick={onExpandToFullView} />
                </>
            )}

            {/* ── State 4: Filter active, with query — scoped results or no-results ── */}
            {isFilterActive && hasQuery && (
                <div>
                    {activeFilter === GlobalSearchFilter.People && searchResults.people.length > 0 && (
                        <div>
                            {searchResults.people.slice(0, 6).map((result) => (
                                <PersonResultRow key={result.userId} result={result} onClick={() => onPersonClick(result)} />
                            ))}
                        </div>
                    )}
                    {activeFilter === GlobalSearchFilter.Rooms && searchResults.rooms.length > 0 && (
                        <div>
                            {searchResults.rooms.slice(0, 6).map((result) => (
                                <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                            ))}
                        </div>
                    )}
                    {activeFilter === GlobalSearchFilter.Spaces && searchResults.spaces.length > 0 && (
                        <div>
                            {searchResults.spaces.slice(0, 6).map((result) => (
                                <SuggestionRow key={result.roomId} room={result.room} onClick={() => onRoomClick(result.roomId)} />
                            ))}
                        </div>
                    )}
                    {!hasFilteredResults && (
                        <SearchResultsRow query={query} onClick={onExpandToFullView} />
                    )}
                    <ViewAllButton label={viewAllLabel} onClick={onExpandToFullView} />
                </div>
            )}
        </div>
    );
}
