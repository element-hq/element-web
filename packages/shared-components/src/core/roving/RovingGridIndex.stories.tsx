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

const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
};

const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
};

const buttonStyle: React.CSSProperties = {
    width: 44,
    height: 36,
};

const activeCellLabelStyle: React.CSSProperties = {
    color: "var(--cpd-color-text-secondary)",
    font: "var(--cpd-font-body-sm-regular)",
};

const gridLabelStyle: React.CSSProperties = {
    color: "var(--cpd-color-text-secondary)",
    font: "var(--cpd-font-body-md-semibold)",
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

function GridRows({ rows }: Readonly<{ rows: string[][] }>): JSX.Element {
    return (
        <>
            {rows.map((row) => (
                <div role="row" style={rowStyle} key={row.join("|")}>
                    {row.map((label) => (
                        <div role="gridcell" key={label}>
                            <GridButton label={label} />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function GridExample({
    rows,
    handleHomeEnd,
    handleInputFields,
    handleLoop,
    moveFocus = true,
    withInput,
}: Readonly<{
    rows: string[][];
    handleHomeEnd?: boolean;
    handleInputFields?: boolean;
    handleLoop?: boolean;
    moveFocus?: React.ComponentProps<typeof RovingGridIndexProvider>["moveFocus"];
    withInput?: boolean;
}>): JSX.Element {
    const [activeLabel, setActiveLabel] = useState(rows[0]?.[0]);

    return (
        <RovingGridIndexProvider
            handleHomeEnd={handleHomeEnd}
            handleInputFields={handleInputFields}
            handleLoop={handleLoop}
            moveFocus={moveFocus}
            onGridNavigation={(_event, target) => setActiveLabel(target.textContent ?? "")}
        >
            {({ onKeyDownHandler }) => (
                <div style={containerStyle}>
                    {withInput && (
                        <input
                            aria-label="Search"
                            aria-activedescendant={activeLabel ? `grid-button-${activeLabel}` : undefined}
                            onKeyDown={onKeyDownHandler}
                            placeholder="Focus stays here; use arrow keys"
                        />
                    )}
                    {withInput && <span style={activeCellLabelStyle}>Active cell: {activeLabel}</span>}
                    <div
                        role="grid"
                        aria-label="Example roving grid"
                        onKeyDown={onKeyDownHandler}
                        style={gridStyle}
                        tabIndex={-1}
                    >
                        <GridRows rows={rows} />
                    </div>
                </div>
            )}
        </RovingGridIndexProvider>
    );
}

function MultipleGridExample({
    grids,
    handleHomeEnd,
    handleLoop,
}: Readonly<{
    grids: Array<{
        label: string;
        rows: string[][];
    }>;
    handleHomeEnd?: boolean;
    handleLoop?: boolean;
}>): JSX.Element {
    return (
        <RovingGridIndexProvider handleHomeEnd={handleHomeEnd} handleLoop={handleLoop}>
            {({ onKeyDownHandler }) => (
                <div style={containerStyle}>
                    {grids.map((grid) => (
                        <section style={containerStyle} key={grid.label}>
                            <span id={`grid-label-${grid.label}`} style={gridLabelStyle}>
                                {grid.label}
                            </span>
                            <div
                                role="grid"
                                aria-labelledby={`grid-label-${grid.label}`}
                                onKeyDown={onKeyDownHandler}
                                style={gridStyle}
                                tabIndex={-1}
                            >
                                <GridRows rows={grid.rows} />
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </RovingGridIndexProvider>
    );
}

const RovingGridIndexWrapper = withViewDocs(GridExample, RovingGridIndexProvider);

const meta = {
    title: "Core/RovingGridIndex",
    component: RovingGridIndexWrapper,
    tags: ["autodocs", "skip-test"],
    args: {
        rows: [],
        handleHomeEnd: true,
        handleLoop: true,
    },
    argTypes: {
        handleHomeEnd: {
            control: "boolean",
        },
        handleInputFields: {
            control: false,
            table: {
                disable: true,
            },
        },
        handleLoop: {
            control: "boolean",
        },
        moveFocus: {
            control: false,
            table: {
                disable: true,
            },
        },
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
        handleHomeEnd: true,
    },
};

export const RaggedRows: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3", "A4"],
            ["B1", "B2"],
            ["C1", "C2", "C3"],
        ],
        handleHomeEnd: true,
    },
};

export const VirtualFocus: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3"],
            ["B1", "B2", "B3"],
        ],
        handleHomeEnd: true,
        handleInputFields: true,
        moveFocus: false,
        withInput: true,
    },
};

export const LoopingGrid: Story = {
    args: {
        rows: [
            ["A1", "A2", "A3"],
            ["B1", "B2", "B3"],
        ],
        handleHomeEnd: true,
        handleLoop: true,
    },
};

export const MultipleGrids: StoryObj<typeof MultipleGridExample> = {
    render: (args) => <MultipleGridExample {...args} />,
    args: {
        grids: [
            {
                label: "Primary grid",
                rows: [
                    ["A1", "A2", "A3"],
                    ["B1", "B2", "B3"],
                ],
            },
            {
                label: "Secondary grid",
                rows: [
                    ["C1", "C2"],
                    ["D1", "D2", "D3"],
                ],
            },
        ],
        handleHomeEnd: true,
    },
};
