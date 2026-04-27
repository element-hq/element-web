/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState } from "react";
import { Search, Form, IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import type { Meta, StoryObj } from "@storybook/react-vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchFieldProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onClear?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearchField({
    placeholder = "Search",
    value,
    onChange,
    onClear,
}: GlobalSearchFieldProps): React.JSX.Element {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        if (e.target.value === "") {
            onClear?.();
        }
        onChange?.(e.target.value);
    }

    return (
        <Form.Root onSubmit={(e) => e.preventDefault()} style={{ position: "relative", width: "100%", maxWidth: "480px" }}>
            <Search
                name="globalSearch"
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                style={{ width: "100%" }}
                className="gs-search-no-cancel"
            />
            {value && (
                <IconButton
                    aria-label="Clear search"
                    size="28px"
                    onClick={() => {
                        onChange?.("");
                        onClear?.();
                    }}
                    style={{
                        position: "absolute",
                        right: "var(--cpd-space-2x)",
                        top: "50%",
                        transform: "translateY(-50%)",
                    }}
                >
                    <CloseIcon width={16} height={16} />
                </IconButton>
            )}
            <style>{`.gs-search-no-cancel input[type="search"]::-webkit-search-cancel-button { display: none; }`}</style>
        </Form.Root>
    );
}

// ── Storybook ─────────────────────────────────────────────────────────────────

const meta = {
    title: "AI Prototypes/Global Search/GlobalSearchField",
    component: GlobalSearchField,
    tags: ["!autodocs"],
    parameters: { layout: "centered" },
} satisfies Meta<typeof GlobalSearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { placeholder: "Search" },
};

export const WithValue: Story = {
    args: { placeholder: "Search", value: "design review" },
    name: "With value",
};

export const Interactive: Story = {
    render: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [value, setValue] = useState("");
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--cpd-space-4x)",
                    alignItems: "center",
                    minWidth: "360px",
                }}
            >
                <GlobalSearchField
                    value={value}
                    onChange={setValue}
                    onClear={() => setValue("")}
                />
                <span style={{ font: "var(--cpd-font-body-sm-regular)", color: "var(--cpd-color-text-secondary)" }}>
                    {value ? `Query: "${value}"` : "No query yet"}
                </span>
            </div>
        );
    },
    name: "Interactive",
};
