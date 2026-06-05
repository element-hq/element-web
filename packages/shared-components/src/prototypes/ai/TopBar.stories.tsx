/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Avatar } from "@vector-im/compound-web";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    HistoryIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import type { Meta, StoryObj } from "@storybook/react-vite";

const logomarkUrl = "https://www.figma.com/api/mcp/asset/e80fc468-ce8a-4cb4-87a7-df4ce338ef28";
const brandedPillLogoUrl = "https://www.figma.com/api/mcp/asset/3cada957-97ed-4731-9c1f-32c8abb23c8f";

// ── Sub-components ─────────────────────────────────────────────────────────────

function ElementLogo(): React.JSX.Element {
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--cpd-space-2x)",
            }}
        >
            <img
                src={logomarkUrl}
                alt="Element"
                style={{ width: "32px", height: "32px", display: "block" }}
            />
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

function BrandedPill(): React.JSX.Element {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                boxSizing: "border-box",
                height: "32px",
                width: "86px",
                padding: "8px",
                border: "1px solid var(--cpd-color-border-interactive-secondary)",
                borderRadius: "39px",
                overflow: "hidden",
                flexShrink: 0,
            }}
        >
            <img
                src={brandedPillLogoUrl}
                alt="Brand logo"
                style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
        </span>
    );
}

// ── TopBar ──────────────────────────────────────────────────────────────────────

// ── Nav button ──────────────────────────────────────────────────────────────────

function NavButton({
    children,
    label,
    disabled = false,
}: {
    children: React.ReactNode;
    label: string;
    disabled?: boolean;
}): React.JSX.Element {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                border: "none",
                borderRadius: "6px",
                background: "none",
                color: disabled ? "var(--cpd-color-icon-disabled)" : "var(--cpd-color-icon-secondary)",
                cursor: disabled ? "default" : "pointer",
                padding: 0,
                flexShrink: 0,
            }}
        >
            {children}
        </button>
    );
}

// ── TopBar ──────────────────────────────────────────────────────────────────────

interface TopBarProps {
    userName?: string;
    userId?: string;
    avatarUrl?: string;
    searchPlaceholder?: string;
}

function TopBar({
    userName = "Alice",
    userId = "@alice:element.io",
    avatarUrl,
    searchPlaceholder = "Search…",
}: TopBarProps): React.JSX.Element {
    return (
        <header
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-4x)",
                height: "52px",
                padding: "0 var(--cpd-space-4x)",
                boxSizing: "border-box",
                backgroundColor: "var(--cpd-color-bg-canvas-default)",
                borderBottom: "1px solid var(--cpd-color-border-disabled)",
                width: "100%",
                overflow: "hidden",
            }}
        >
            {/* Left: Element logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-3x)", flexShrink: 0 }}>
                <ElementLogo />
            </div>

            {/* Centre: Nav controls + Search */}
            <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(480px + 28px + 28px + 28px + var(--cpd-space-2x) * 3)", margin: "0 auto", display: "flex", alignItems: "center", gap: "var(--cpd-space-2x)" }}>
                {/* Back / Forward / History */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-1x)", flexShrink: 0 }}>
                    <NavButton label="Go back" disabled>
                        <ChevronLeftIcon width={18} height={18} />
                    </NavButton>
                    <NavButton label="Go forward">
                        <ChevronRightIcon width={18} height={18} />
                    </NavButton>
                    <NavButton label="History">
                        <HistoryIcon width={18} height={18} />
                    </NavButton>
                </div>

                {/* Search pill */}
                <input
                    type="search"
                    placeholder={searchPlaceholder}
                    style={{
                        flex: 1,
                        minWidth: 0,
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

            {/* Right: Branded pill + Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-3x)", flexShrink: 0, marginLeft: "auto" }}>
                <BrandedPill />
                <Avatar
                    id={userId}
                    name={userName}
                    src={avatarUrl}
                    size="32px"
                    type="round"
                    onClick={() => {}}
                />
            </div>
        </header>
    );
}

// ── Storybook meta ──────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Top Bar",
    component: TopBar,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["!autodocs"],
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAvatar: Story = {
    args: {
        userName: "Alice",
        userId: "@alice:element.io",
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    },
};
