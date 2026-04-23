/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Avatar, Search, Root } from "@vector-im/compound-web";

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
                maxHeight: "52px",
                height: "52px",
                padding: "0 var(--cpd-space-4x)",
                boxSizing: "border-box",
                backgroundColor: "var(--cpd-color-bg-canvas-default)",
                borderBottom: "1px solid var(--cpd-color-border-disabled)",
                width: "100%",
            }}
        >
            {/* Left: Element logo + branded pill */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cpd-space-3x)", flexShrink: 0 }}>
                <ElementLogo />
            </div>

            {/* Centre: Search */}
            <div style={{ flex: 1, minWidth: 0, maxWidth: "480px", margin: "0 auto" }}>
                <Root>
                    <Search name="topbar-search" placeholder={searchPlaceholder} style={{ width: "100%" }} />
                </Root>
            </div>

            {/* Right: Avatar button */}
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
