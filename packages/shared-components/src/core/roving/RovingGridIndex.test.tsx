/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { RovingGridIndexProvider, useRovingTabIndex } from ".";

const offsetParentDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
if (offsetParentDescriptor?.configurable !== false) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
        configurable: true,
        get() {
            return this.parentNode;
        },
    });
}

function GridButton({ label }: Readonly<{ label: string }>): React.ReactElement {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();

    return (
        <button ref={ref} tabIndex={isActive ? 0 : -1} onFocus={onFocus}>
            {label}
        </button>
    );
}

function DefaultGrid({
    rows,
    props,
    beforeGrid,
}: Readonly<{
    rows: string[][];
    props?: Partial<React.ComponentProps<typeof RovingGridIndexProvider>>;
    beforeGrid?: ReactNode;
}>): React.ReactElement {
    return (
        <RovingGridIndexProvider {...props}>
            {({ onKeyDownHandler }) => (
                <div>
                    {beforeGrid &&
                        React.isValidElement(beforeGrid) &&
                        React.cloneElement(beforeGrid, {
                            onKeyDown: onKeyDownHandler,
                        } as Partial<React.HTMLAttributes<HTMLElement>>)}
                    <div role="grid" aria-label="Roving grid" onKeyDown={onKeyDownHandler} tabIndex={-1}>
                        {rows.map((row, rowIndex) => (
                            <div role="row" key={rowIndex}>
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

const getButton = (name: string): HTMLButtonElement => screen.getByRole("button", { name });

const expectTabIndexes = (labels: string[], activeLabel: string): void => {
    for (const label of labels) {
        expect(getButton(label)).toHaveAttribute("tabindex", label === activeLabel ? "0" : "-1");
    }
};

describe("RovingGridIndexProvider", () => {
    it("moves horizontally through registered grid cells", async () => {
        const user = userEvent.setup();
        render(<DefaultGrid rows={[["A1", "A2", "A3"]]} />);

        expectTabIndexes(["A1", "A2", "A3"], "A1");

        await user.tab();
        expect(getButton("A1")).toHaveFocus();

        await user.keyboard("{ArrowRight}");
        expect(getButton("A2")).toHaveFocus();
        expectTabIndexes(["A1", "A2", "A3"], "A2");

        await user.keyboard("{ArrowLeft}");
        expect(getButton("A1")).toHaveFocus();
        expectTabIndexes(["A1", "A2", "A3"], "A1");
    });

    it("moves vertically while preserving the column", async () => {
        const user = userEvent.setup();
        render(
            <DefaultGrid
                rows={[
                    ["A1", "A2", "A3"],
                    ["B1", "B2", "B3"],
                    ["C1", "C2", "C3"],
                ]}
            />,
        );

        await user.tab();
        await user.keyboard("{ArrowRight}");
        expect(getButton("A2")).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(getButton("B2")).toHaveFocus();
        expectTabIndexes(["A2", "B2"], "B2");

        await user.keyboard("{ArrowDown}");
        expect(getButton("C2")).toHaveFocus();

        await user.keyboard("{ArrowUp}");
        expect(getButton("B2")).toHaveFocus();
    });

    it("clamps vertical movement for ragged rows", async () => {
        const user = userEvent.setup();
        render(
            <DefaultGrid
                rows={[
                    ["A1", "A2", "A3"],
                    ["B1", "B2"],
                ]}
            />,
        );

        await user.tab();
        await user.keyboard("{ArrowRight}");
        await user.keyboard("{ArrowRight}");
        expect(getButton("A3")).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(getButton("B2")).toHaveFocus();
        expectTabIndexes(["A3", "B2"], "B2");
    });

    it("moves vertically across separate grid containers", async () => {
        const user = userEvent.setup();
        render(
            <RovingGridIndexProvider>
                {({ onKeyDownHandler }) => (
                    <>
                        <div role="grid" aria-label="First roving grid" onKeyDown={onKeyDownHandler} tabIndex={-1}>
                            <div role="row">
                                {["A1", "A2", "A3"].map((label) => (
                                    <div role="gridcell" key={label}>
                                        <GridButton label={label} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div role="grid" aria-label="Second roving grid" onKeyDown={onKeyDownHandler} tabIndex={-1}>
                            <div role="row">
                                {["B1", "B2"].map((label) => (
                                    <div role="gridcell" key={label}>
                                        <GridButton label={label} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </RovingGridIndexProvider>,
        );

        await user.tab();
        await user.keyboard("{ArrowRight}");
        await user.keyboard("{ArrowRight}");
        expect(getButton("A3")).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(getButton("B2")).toHaveFocus();
    });

    it("keeps the active cell unchanged at grid boundaries", async () => {
        const user = userEvent.setup();
        render(<DefaultGrid rows={[["A1", "A2"]]} />);

        await user.tab();
        await user.keyboard("{ArrowLeft}");
        expect(getButton("A1")).toHaveFocus();
        expectTabIndexes(["A1", "A2"], "A1");
    });

    it("can update active state without moving DOM focus", async () => {
        const user = userEvent.setup();
        render(
            <DefaultGrid
                rows={[["A1", "A2"]]}
                props={{ handleInputFields: true, moveFocus: false }}
                beforeGrid={<input aria-label="Search" />}
            />,
        );

        await user.click(screen.getByRole("textbox", { name: "Search" }));
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();

        await user.keyboard("{ArrowRight}");
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
        expectTabIndexes(["A1", "A2"], "A2");
    });

    it("allows moveFocus to be decided per navigation target", async () => {
        const user = userEvent.setup();
        const moveFocus = vi.fn((target: HTMLElement) => target.textContent !== "A2");
        render(
            <DefaultGrid
                rows={[["A1", "A2", "A3"]]}
                props={{ handleInputFields: true, moveFocus }}
                beforeGrid={<input aria-label="Search" />}
            />,
        );

        await user.click(screen.getByRole("textbox", { name: "Search" }));
        await user.keyboard("{ArrowRight}");

        expect(moveFocus).toHaveBeenCalledWith(getButton("A2"), expect.anything(), expect.anything());
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
        expectTabIndexes(["A1", "A2", "A3"], "A2");

        await user.keyboard("{ArrowRight}");
        expect(getButton("A3")).toHaveFocus();
    });

    it("keeps native input arrow-key behaviour unless input handling is enabled", async () => {
        const user = userEvent.setup();
        render(
            <DefaultGrid
                rows={[["A1", "A2"]]}
                props={{ moveFocus: false }}
                beforeGrid={<input aria-label="Search" />}
            />,
        );

        await user.click(screen.getByRole("textbox", { name: "Search" }));
        await user.keyboard("{ArrowRight}");

        expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
        expectTabIndexes(["A1", "A2"], "A1");
    });

    it("scrolls the target into view when configured", async () => {
        const user = userEvent.setup();
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: scrollIntoView,
        });
        render(<DefaultGrid rows={[["A1", "A2"]]} props={{ scrollIntoView: { block: "center" } }} />);

        await user.tab();
        await user.keyboard("{ArrowRight}");

        expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    });

    it("supports custom grid markup resolvers", async () => {
        const user = userEvent.setup();
        render(
            <RovingGridIndexProvider
                getGridCell={(node) => node.closest("[data-grid-cell]") ?? undefined}
                getRovingNode={(cell) => cell.querySelector("button") ?? undefined}
            >
                {({ onKeyDownHandler }) => (
                    <div role="grid" aria-label="Roving grid" onKeyDown={onKeyDownHandler} tabIndex={-1}>
                        <div role="row">
                            <div data-grid-cell>
                                <span>
                                    <GridButton label="A1" />
                                </span>
                            </div>
                            <div data-grid-cell>
                                <span>
                                    <GridButton label="A2" />
                                </span>
                            </div>
                        </div>
                        <div role="row">
                            <div data-grid-cell>
                                <span>
                                    <GridButton label="B1" />
                                </span>
                            </div>
                            <div data-grid-cell>
                                <span>
                                    <GridButton label="B2" />
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </RovingGridIndexProvider>,
        );

        await user.tab();
        await user.keyboard("{ArrowDown}");

        expect(getButton("B1")).toHaveFocus();
    });
});
