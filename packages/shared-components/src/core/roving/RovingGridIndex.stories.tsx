/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { RovingGridIndexProvider, useRovingTabIndex } from ".";

const gridStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 4,
    padding: 12,
    border: "1px solid var(--cpd-color-border-interactive-secondary)",
    borderRadius: 8,
};

const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
};

const buttonStyle: React.CSSProperties = {
    width: 44,
    height: 36,
};

function GridButton({ label }: Readonly<{ label: string }>): JSX.Element {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();

    return (
        <button
            ref={ref}
            id={`grid-button-${label}`}
            style={buttonStyle}
            tabIndex={isActive ? 0 : -1}
            onFocus={onFocus}
        >
            {label}
        </button>
    );
}

function GridExample({
    rows,
    handleInputFields,
    handleLoop,
    moveFocus = true,
    withInput,
}: Readonly<{
    rows: string[][];
    handleInputFields?: boolean;
    handleLoop?: boolean;
    moveFocus?: React.ComponentProps<typeof RovingGridIndexProvider>["moveFocus"];
    withInput?: boolean;
}>): JSX.Element {
    const [activeLabel, setActiveLabel] = useState(rows[0]?.[0]);

    return (
        <RovingGridIndexProvider
            handleInputFields={handleInputFields}
            handleLoop={handleLoop}
            moveFocus={moveFocus}
            onGridNavigation={(_event, target) => setActiveLabel(target.textContent ?? "")}
        >
            {({ onKeyDownHandler }) => (
                <div>
                    {withInput && (
                        <input
                            aria-label="Search"
                            aria-activedescendant={activeLabel ? `grid-button-${activeLabel}` : undefined}
                            onKeyDown={onKeyDownHandler}
                            placeholder="Search"
                            style={{ marginBottom: 8 }}
                        />
                    )}
                    <div
                        role="grid"
                        aria-label="Example roving grid"
                        onKeyDown={onKeyDownHandler}
                        style={gridStyle}
                        tabIndex={-1}
                    >
                        {rows.map((row, rowIndex) => (
                            <div role="row" style={rowStyle} key={rowIndex}>
                                {row.map((label) => (
                                    <div role="gridcell" key={label}>
                                        <GridButton label={label} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </RovingGridIndexProvider>
    );
}

const RovingGridIndexWrapper = withViewDocs(GridExample, RovingGridIndexProvider);

const meta = {
    title: "Core/RovingGridIndex",
    component: RovingGridIndexWrapper,
    tags: ["autodocs"],
    argTypes: {
        withInput: {
            control: false,
            table: {
                disable: true,
            },
        },
    },
} satisfies Meta<typeof RovingGridIndexWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultGrid: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3", "A4"],
            ["B1", "B2", "B3", "B4"],
            ["C1", "C2", "C3", "C4"],
        ],
    },
};

export const RaggedRows: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3", "A4"],
            ["B1", "B2"],
            ["C1", "C2", "C3"],
        ],
    },
};

export const VirtualFocus: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3"],
            ["B1", "B2", "B3"],
        ],
        handleInputFields: true,
        moveFocus: false,
        withInput: true,
    },
};

export const LoopingHorizontalNavigation: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3"],
            ["B1", "B2", "B3"],
        ],
        handleLoop: true,
    },
};
