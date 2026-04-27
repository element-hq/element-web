/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchFilter = "All" | "People" | "Rooms" | "Messages" | "Spaces";

const ALL_FILTERS: SearchFilter[] = ["All", "People", "Rooms", "Messages", "Spaces"];

// ── Component ─────────────────────────────────────────────────────────────────

interface ChatFilterChipProps {
    label: SearchFilter;
    active?: boolean;
    onClick?: (label: SearchFilter) => void;
}

export function ChatFilterChip({ label, active = false, onClick }: ChatFilterChipProps): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={() => onClick?.(label)}
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
                transition: "background 0.1s, color 0.1s, border-color 0.1s",
                flexShrink: 0,
            }}
            aria-pressed={active}
        >
            {label}
        </button>
    );
}

// ── Filter bar (composed) ─────────────────────────────────────────────────────

interface ChatFilterBarProps {
    active?: SearchFilter;
    filters?: SearchFilter[];
    onChange?: (filter: SearchFilter) => void;
}

export function ChatFilterBar({ active = "All", filters = ALL_FILTERS, onChange }: ChatFilterBarProps): React.JSX.Element {
    const [current, setCurrent] = useState<SearchFilter>(active);

    const handleClick = (filter: SearchFilter): void => {
        setCurrent(filter);
        onChange?.(filter);
    };

    return (
        <div
            role="tablist"
            aria-label="Search filters"
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cpd-space-2x)",
                padding: "var(--cpd-space-2x) var(--cpd-space-4x)",
                overflowX: "auto",
            }}
        >
            {filters.map((f) => (
                <ChatFilterChip key={f} label={f} active={current === f} onClick={handleClick} />
            ))}
        </div>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/ChatFilterChip",
    component: ChatFilterChip,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
} satisfies Meta<typeof ChatFilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { label: "All", active: false },
};

export const Active: Story = {
    args: { label: "People", active: true },
};

export const AllChips: Story = {
    render: () => <ChatFilterBar />,
    name: "Filter Bar (all chips)",
};

export const PeopleActive: Story = {
    render: () => <ChatFilterBar active="People" />,
    name: "Filter Bar — People active",
};
