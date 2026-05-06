/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import { ChevronLeftIcon, ChevronRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";

import elementLogoUrl from "../../../res/themes/element/img/logos/element-logo.svg";
import UserMenu from "./UserMenu";
import { GlobalSearchViewModel } from "../../viewmodels/globalSearch/GlobalSearchViewModel";
import { GlobalSearchDropdown } from "./GlobalSearchDropdown";
import { GlobalSearchFullView } from "./GlobalSearchFullView";

function ElementLogo(): JSX.Element {
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--cpd-space-2x)",
            }}
        >
            <img src={elementLogoUrl} alt="Element" style={{ width: "32px", height: "32px", display: "block" }} />
            <span
                style={{
                    color: "var(--cpd-color-text-primary)",
                    fontFamily: '"Eina 04", "Eina", "Arial", sans-serif',
                    fontSize: "21px",
                    lineHeight: "20.8px",
                    letterSpacing: "-0.525px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                }}
            >
                element
            </span>
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--cpd-color-green-800)",
                    background: "var(--cpd-color-green-300)",
                    color: "var(--cpd-color-green-900)",
                    fontFamily: '"Eina 02", "Eina", "Arial", sans-serif',
                    fontSize: "12px",
                    lineHeight: 1.5,
                    letterSpacing: "-0.3px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                }}
            >
                PRO
            </span>
        </div>
    );
}

/**
 * Top bar component displayed at the top of the application.
 * Shows the Element logo, a global search bar, and the current user's avatar.
 */
export function TopBar(): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const vm = useCreateAutoDisposedViewModel(
        () => new GlobalSearchViewModel({ onClose: () => setIsOpen(false) }),
        [],
    );
    const { query, filter, isFullView, recentSearches } = useViewModel(vm);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            vm.onQueryChange(e.target.value);
        },
        [vm],
    );

    const handleFocus = useCallback(() => {
        setIsOpen(true);
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Escape") {
                vm.onClose();
                inputRef.current?.blur();
            } else if (e.key === "Enter") {
                vm.onExpandToFullView();
            }
        },
        [vm],
    );

    // Close dropdown on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (e: PointerEvent): void => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                vm.onClose();
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [isOpen, vm]);

    // Close full-view when user navigates to a room or switches space
    useEffect(() => {
        const token = defaultDispatcher.register((payload) => {
            if (
                payload.action === Action.ViewRoom ||
                payload.action === Action.SwitchSpace
            ) {
                vm.onCollapseToDropdown();
                vm.onClose();
            }
        });
        return () => defaultDispatcher.unregister(token);
    }, [vm]);

    return (
        <>
        <header
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-4x)",
                maxHeight: "52px",
                height: "52px",
                padding: "0 var(--cpd-space-4x)",
                boxSizing: "border-box",
                backgroundColor: "var(--cpd-color-bg-canvas-default)",
                borderBottom: "1px solid var(--cpd-color-border-disabled)",
                width: "100%",
                flexShrink: 0,
            }}
        >
            {/* Left: Element logo + nav chevrons */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)", flexShrink: 0 }}>
                <ElementLogo />
                <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-1x)", marginLeft: "var(--cpd-space-2x)" }}>
                    <button
                        type="button"
                        aria-label="Go back"
                        onClick={() => isFullView ? vm.onCollapseToDropdown() : window.history.back()}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            border: "none",
                            borderRadius: "6px",
                            background: "none",
                            color: "var(--cpd-color-icon-secondary)",
                            cursor: "pointer",
                            padding: 0,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                        <ChevronLeftIcon width={18} height={18} />
                    </button>
                    <button
                        type="button"
                        aria-label="Go forward"
                        onClick={() => window.history.forward()}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            border: "none",
                            borderRadius: "6px",
                            background: "none",
                            color: "var(--cpd-color-icon-secondary)",
                            cursor: "pointer",
                            padding: 0,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--cpd-color-bg-subtle-secondary)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                        <ChevronRightIcon width={18} height={18} />
                    </button>
                </div>
            </div>

            {/* Centre: Search */}
            <div ref={containerRef} style={{ flex: 1, minWidth: 0, maxWidth: "480px", margin: "0 auto", position: "relative" }}>
                <input
                    ref={inputRef}
                    type="search"
                    placeholder="Search…"
                    value={query}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    aria-label="Global search"
                    aria-expanded={isOpen}
                    style={{
                        width: "100%",
                        height: "36px",
                        padding: "0 var(--cpd-space-3x)",
                        boxSizing: "border-box",
                        border: "1px solid var(--cpd-color-border-interactive-secondary)",
                        borderRadius: "var(--cpd-radius-pill-effect)",
                        background: "var(--cpd-color-bg-subtle-secondary)",
                        color: "var(--cpd-color-text-primary)",
                        font: "var(--cpd-font-body-md-regular)",
                        outline: "none",
                    }}
                />
                {isOpen && (
                    <GlobalSearchDropdown
                        query={query}
                        activeFilter={filter}
                        recentSearches={recentSearches}
                        onFilterChange={vm.onFilterChange}
                        onExpandToFullView={vm.onExpandToFullView}
                        onRoomClick={vm.onRoomClick}
                        onPersonClick={vm.onPersonClick}
                    />
                )}
            </div>

            {/* Right: User menu avatar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    marginLeft: "auto",
                }}
            >
                <UserMenu isPanelCollapsed={false} hideLabel={true} />
            </div>
        </header>

        {/* Full-view overlay — rendered via portal over the content area */}
        {isFullView && (
            <GlobalSearchFullView
                query={query}
                activeFilter={filter}
                onFilterChange={vm.onFilterChange}
                onCollapseToDropdown={vm.onCollapseToDropdown}
            />
        )}
        </>
    );
}
