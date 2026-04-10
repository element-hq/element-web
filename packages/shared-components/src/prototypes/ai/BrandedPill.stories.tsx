/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

const logoUrl = "https://www.figma.com/api/mcp/asset/3cada957-97ed-4731-9c1f-32c8abb23c8f";

interface BrandedPillProps {
    logoSrc?: string;
    logoAlt?: string;
}

function BrandedPill({ logoSrc = logoUrl, logoAlt = "Logo" }: BrandedPillProps): React.JSX.Element {
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
            }}
        >
            <img
                src={logoSrc}
                alt={logoAlt}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                }}
            />
        </span>
    );
}

const meta = {
    title: "AI Prototypes/Branded Pill",
    component: BrandedPill,
    tags: ["!autodocs"],
} satisfies Meta<typeof BrandedPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
