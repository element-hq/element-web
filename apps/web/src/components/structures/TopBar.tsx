/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import elementLogoUrl from "../../../res/themes/element/img/logos/element-logo.svg";
import UserMenu from "./UserMenu";

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
    return (
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
            {/* Left: Element logo */}
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <ElementLogo />
            </div>

            {/* Centre: Search */}
            <div style={{ flex: 1, minWidth: 0, maxWidth: "480px", margin: "0 auto" }}>
                <input
                    type="search"
                    placeholder="Search…"
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
    );
}
