/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

const logomarkUrl = "https://www.figma.com/api/mcp/asset/e80fc468-ce8a-4cb4-87a7-df4ce338ef28";

interface ElementLogoProps {
    logoText?: string;
    badgeText?: string;
    logoAlt?: string;
}

function ElementLogo({ logoText = "element", badgeText = "PRO", logoAlt = "Element" }: ElementLogoProps): React.JSX.Element {
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--cpd-space-2x)",
                minHeight: "32px",
            }}
        >
            <img
                src={logomarkUrl}
                alt={logoAlt}
                style={{
                    width: "32px",
                    height: "32px",
                    display: "block",
                }}
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
                {logoText}
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
                {badgeText}
            </span>
        </div>
    );
}

const meta = {
    title: "AI Prototypes/Element Logo",
    component: ElementLogo,
    tags: ["!autodocs"],
} satisfies Meta<typeof ElementLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
