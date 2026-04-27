/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultType = "Room" | "Message" | "Person" | "Space" | "Recent";

// ── Icons (inline SVGs matching Compound/Figma glyphs) ────────────────────────

function RoomIcon(): React.JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m8.566 17-.944 4.094q-.086.406-.372.656t-.687.25q-.543 0-.887-.469a1.18 1.18 0 0 1-.2-1.031l.801-3.5H3.158q-.572 0-.916-.484a1.27 1.27 0 0 1-.2-1.078 1.12 1.12 0 0 1 1.116-.938H6.85l1.145-5h-3.12q-.57 0-.915-.484a1.27 1.27 0 0 1-.2-1.078A1.12 1.12 0 0 1 4.875 7h3.691l.945-4.094q.085-.406.372-.656.286-.25.686-.25.544 0 .887.469.345.468.2 1.031l-.8 3.5h4.578l.944-4.094q.085-.406.372-.656.286-.25.687-.25.543 0 .887.469t.2 1.031L17.723 7h3.119q.573 0 .916.484.343.485.2 1.079a1.12 1.12 0 0 1-1.116.937H17.15l-1.145 5h3.12q.57 0 .915.484.343.485.2 1.079a1.12 1.12 0 0 1-1.116.937h-3.691l-.944 4.094q-.087.406-.373.656t-.686.25q-.544 0-.887-.469a1.18 1.18 0 0 1-.2-1.031l.8-3.5zm.573-2.5h4.578l1.144-5h-4.578z" />
        </svg>
    );
}

function MessageIcon(): React.JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m1.5 21.25 1.45-4.95a10.2 10.2 0 0 1-.712-2.1A10.2 10.2 0 0 1 2 12q0-2.075.788-3.9a10.1 10.1 0 0 1 2.137-3.175q1.35-1.35 3.175-2.137A9.7 9.7 0 0 1 12 2q2.075 0 3.9.788a10.1 10.1 0 0 1 3.175 2.137q1.35 1.35 2.137 3.175A9.7 9.7 0 0 1 22 12a9.7 9.7 0 0 1-.788 3.9 10.1 10.1 0 0 1-2.137 3.175q-1.35 1.35-3.175 2.137A9.7 9.7 0 0 1 12 22q-1.125 0-2.2-.238a10.2 10.2 0 0 1-2.1-.712z" />
        </svg>
    );
}

function PersonIcon(): React.JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9.175 13.825Q10.35 15 12 15t2.825-1.175T16 11t-1.175-2.825T12 7 9.175 8.175 8 11t1.175 2.825" />
            <path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-2 0a8 8 0 1 0-16 0 8 8 0 0 0 16 0" />
            <path d="M16.23 18.792a13 13 0 0 0-1.455-.455 11.6 11.6 0 0 0-5.55 0q-.73.18-1.455.455a8 8 0 0 1-1.729-1.454q1.336-.618 2.709-.95A13.8 13.8 0 0 1 12 16q1.65 0 3.25.387 1.373.333 2.709.95a8 8 0 0 1-1.73 1.455" />
        </svg>
    );
}

function SpaceIcon(): React.JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 21q-1.65 0-2.825-1.175T2 17t1.175-2.825T6 13t2.825 1.175T10 17t-1.175 2.825T6 21m12 0q-1.65 0-2.825-1.175T14 17t1.175-2.825T18 13t2.825 1.175T22 17t-1.175 2.825T18 21M6 19q.824 0 1.412-.587Q8 17.825 8 17t-.588-1.412A1.93 1.93 0 0 0 6 15q-.824 0-1.412.588A1.93 1.93 0 0 0 4 17q0 .824.588 1.413Q5.175 19 6 19m12 0q.824 0 1.413-.587Q20 17.825 20 17t-.587-1.412A1.93 1.93 0 0 0 18 15q-.824 0-1.413.588A1.93 1.93 0 0 0 16 17q0 .824.587 1.413Q17.176 19 18 19m-6-8q-1.65 0-2.825-1.175T8 7t1.175-2.825T12 3t2.825 1.175T16 7t-1.175 2.825T12 11m0-2q.825 0 1.412-.588Q14 7.826 14 7q0-.824-.588-1.412A1.93 1.93 0 0 0 12 5q-.825 0-1.412.588A1.93 1.93 0 0 0 10 7q0 .824.588 1.412Q11.175 9 12 9" />
        </svg>
    );
}

function RecentIcon(): React.JSX.Element {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18m0-2a7 7 0 1 0 0-14 7 7 0 0 0 0 14m1-7.586 2.293 2.293-1.414 1.414L11 12.414V7h2z" />
        </svg>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SearchTypeIconProps {
    type: SearchResultType;
}

export function SearchTypeIcon({ type }: SearchTypeIconProps): React.JSX.Element {
    const iconMap: Record<SearchResultType, React.JSX.Element> = {
        Room: <RoomIcon />,
        Message: <MessageIcon />,
        Person: <PersonIcon />,
        Space: <SpaceIcon />,
        Recent: <RecentIcon />,
    };

    return (
        <span
            aria-label={type}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "var(--cpd-radius-pill-effect)",
                background: "var(--cpd-color-bg-subtle-secondary)",
                color: "var(--cpd-color-icon-secondary)",
                flexShrink: 0,
            }}
        >
            {iconMap[type]}
        </span>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/SearchTypeIcon",
    component: SearchTypeIcon,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
    argTypes: {
        type: {
            control: "select",
            options: ["Room", "Message", "Person", "Space", "Recent"] satisfies SearchResultType[],
        },
    },
} satisfies Meta<typeof SearchTypeIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = { args: { type: "Room" } };
export const Message: Story = { args: { type: "Message" } };
export const Person: Story = { args: { type: "Person" } };
export const Space: Story = { args: { type: "Space" } };
export const Recent: Story = { args: { type: "Recent" } };

export const AllIcons: Story = {
    render: () => (
        <div style={{ display: "flex", gap: "var(--cpd-space-3x)", alignItems: "center" }}>
            {(["Room", "Message", "Person", "Space", "Recent"] as SearchResultType[]).map((t) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <SearchTypeIcon type={t} />
                    <span style={{ font: "var(--cpd-font-body-xs-regular)", color: "var(--cpd-color-text-secondary)" }}>
                        {t}
                    </span>
                </div>
            ))}
        </div>
    ),
    name: "All icons",
};
