/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchSectionType = "Suggestions" | "People" | "Rooms" | "Spaces" | "Apps";

// ── Component ─────────────────────────────────────────────────────────────────

interface SearchSectionHeaderProps {
    type: SearchSectionType;
}

export function SearchSectionHeader({ type }: SearchSectionHeaderProps): React.JSX.Element {
    return (
        <div
            style={{
                padding: "var(--cpd-space-1x) var(--cpd-space-3x)",
                marginTop: "var(--cpd-space-2x)",
            }}
        >
            <span
                style={{
                    font: "var(--cpd-font-body-xs-semibold)",
                    color: "var(--cpd-color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                }}
            >
                {type}
            </span>
        </div>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/SearchSectionHeader",
    component: SearchSectionHeader,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
    argTypes: {
        type: {
            control: "select",
            options: ["Suggestions", "People", "Rooms", "Spaces", "Apps"] satisfies SearchSectionType[],
        },
    },
} satisfies Meta<typeof SearchSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggestions: Story = { args: { type: "Suggestions" } };
export const People: Story = { args: { type: "People" } };
export const Rooms: Story = { args: { type: "Rooms" } };
export const Spaces: Story = { args: { type: "Spaces" } };

export const AllHeaders: Story = {
    render: () => (
        <div
            style={{
                background: "var(--cpd-color-bg-canvas-default)",
                borderRadius: "8px",
                border: "1px solid var(--cpd-color-border-disabled)",
                minWidth: "320px",
                padding: "var(--cpd-space-2x) 0",
            }}
        >
            {(["Suggestions", "People", "Rooms", "Spaces"] as SearchSectionType[]).map((t) => (
                <SearchSectionHeader key={t} type={t} />
            ))}
        </div>
    ),
    name: "All headers",
};
