/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type DateSeparatorViewModel, type DateSeparatorViewSnapshot } from "./DateSeparatorView";
import { DateSeparatorContextMenu } from "./DateSeparatorContextMenu";

class TestDateSeparatorViewModel implements DateSeparatorViewModel {
    private listeners = new Set<() => void>();

    public constructor(private snapshot: DateSeparatorViewSnapshot) {}

    public getSnapshot = (): DateSeparatorViewSnapshot => this.snapshot;

    public subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    public onLastWeekPicked = vi.fn<() => void>();
    public onLastMonthPicked = vi.fn<() => void>();
    public onBeginningPicked = vi.fn<() => void>();
    public onDatePicked = vi.fn<(dateString: string) => void>();
}

function renderMenu({
    open = true,
    jumpToEnabled = true,
    onOpenChange = vi.fn<(open: boolean) => void>(),
}: {
    open?: boolean;
    jumpToEnabled?: boolean;
    onOpenChange?: (open: boolean) => void;
} = {}): { vm: TestDateSeparatorViewModel; onOpenChange: (open: boolean) => void } {
    const vm = new TestDateSeparatorViewModel({
        label: "Today",
        jumpToEnabled,
        jumpToTimestamp: new Date("2025-01-15T12:00:00.000Z").getTime(),
    });

    render(
        <DateSeparatorContextMenu vm={vm} open={open} onOpenChange={onOpenChange}>
            <button type="button" data-testid="jump-to-trigger">
                Trigger
            </button>
        </DateSeparatorContextMenu>,
    );

    return { vm, onOpenChange };
}

describe("DateSeparatorContextMenu", () => {
    it("renders menu actions and date picker when open", () => {
        renderMenu({ open: true, jumpToEnabled: true });

        expect(screen.getByTestId("jump-to-date-last-week")).toBeInTheDocument();
        expect(screen.getByTestId("jump-to-date-last-month")).toBeInTheDocument();
        expect(screen.getByTestId("jump-to-date-beginning")).toBeInTheDocument();
        expect(screen.getByTestId("jump-to-date-picker")).toBeInTheDocument();
    });

    it("hides date picker when jumpToEnabled is false", () => {
        renderMenu({ open: true, jumpToEnabled: false });

        expect(screen.getByTestId("jump-to-date-last-week")).toBeInTheDocument();
        expect(screen.queryByTestId("jump-to-date-picker")).not.toBeInTheDocument();
    });

    it("calls onOpenChange for opening and closing transitions", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn<(open: boolean) => void>();

        renderMenu({ open: false, jumpToEnabled: true, onOpenChange });
        await user.click(screen.getByTestId("jump-to-trigger"));
        expect(onOpenChange).toHaveBeenCalledWith(true);

        renderMenu({ open: true, jumpToEnabled: true, onOpenChange });
        await user.click(screen.getByTestId("jump-to-date-last-week"));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("wires week/month/beginning menu actions to the correct callbacks", async () => {
        const user = userEvent.setup();
        const { vm } = renderMenu({ open: true, jumpToEnabled: true });

        await user.click(screen.getByTestId("jump-to-date-last-week"));
        await user.click(screen.getByTestId("jump-to-date-last-month"));
        await user.click(screen.getByTestId("jump-to-date-beginning"));

        expect(vm.onLastWeekPicked).toHaveBeenCalledTimes(1);
        expect(vm.onLastMonthPicked).toHaveBeenCalledTimes(1);
        expect(vm.onBeginningPicked).toHaveBeenCalledTimes(1);
    });

    it("submits date picker and closes the menu", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn<(open: boolean) => void>();
        const { vm } = renderMenu({ open: true, jumpToEnabled: true, onOpenChange });

        const dateInput = screen.getByLabelText("Pick a date to jump to");
        fireEvent.input(dateInput, { target: { value: "2025-01-10" } });
        await user.click(screen.getByRole("button", { name: "Go" }));

        expect(vm.onDatePicked).toHaveBeenCalledWith("2025-01-10");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("moves focus from date input to submit button on Tab", async () => {
        const user = userEvent.setup();
        renderMenu({ open: true, jumpToEnabled: true });

        const dateInput = screen.getByLabelText("Pick a date to jump to");
        const submitButton = screen.getByRole("button", { name: "Go" });
        dateInput.focus();
        await user.keyboard("{Tab}");

        expect(submitButton).toHaveFocus();
    });

    it("submits date picker with Enter on the submit button", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn<(open: boolean) => void>();
        const { vm } = renderMenu({ open: true, jumpToEnabled: true, onOpenChange });

        const dateInput = screen.getByLabelText("Pick a date to jump to");
        fireEvent.input(dateInput, { target: { value: "2025-01-11" } });

        const submitButton = screen.getByRole("button", { name: "Go" });
        submitButton.focus();
        await user.keyboard("{Enter}");

        expect(vm.onDatePicked).toHaveBeenCalledWith("2025-01-11");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("submits date picker with Space on the submit button", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn<(open: boolean) => void>();
        const { vm } = renderMenu({ open: true, jumpToEnabled: true, onOpenChange });

        const dateInput = screen.getByLabelText("Pick a date to jump to");
        fireEvent.input(dateInput, { target: { value: "2025-01-12" } });

        const submitButton = screen.getByRole("button", { name: "Go" });
        submitButton.focus();
        await user.keyboard(" ");

        expect(vm.onDatePicked).toHaveBeenCalledWith("2025-01-12");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
