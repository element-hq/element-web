/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@test-utils";

import { SetStatusView, type SetStatusViewActions, type SetStatusViewSnapshot } from "./SetStatusView";
import { MockViewModel } from "../core/viewmodel/MockViewModel";
import { BaseViewModel } from "../core/viewmodel/BaseViewModel";
import { type UserStatus } from "../core/userStatus";

class SetStatusViewModel extends MockViewModel<SetStatusViewSnapshot> implements SetStatusViewActions {
    public setStatus = vi.fn();
    public clearStatus = vi.fn();
}

/**
 * A view model whose status changes when it is set, so the view re-renders.
 */
class LiveSetStatusViewModel
    extends BaseViewModel<SetStatusViewSnapshot, Record<string, never>>
    implements SetStatusViewActions
{
    public constructor() {
        super({}, {});
    }
    public setStatus = vi.fn((userStatus: UserStatus) => this.snapshot.merge({ userStatus }));
    public clearStatus = vi.fn();
}

/**
 * Open the dropdown and pick the "Custom…" entry, leaving it ready to enter a
 * custom status / pick an emoji.
 */
async function openCustomEditor(): Promise<void> {
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "✍️Custom…" }));
}

describe("SetStatusView", () => {
    it("lets the user type a custom status", async () => {
        const vm = new SetStatusViewModel({});
        render(<SetStatusView vm={vm} />);

        await openCustomEditor();

        await userEvent.type(screen.getByRole("textbox", { name: "What's your status?" }), "Happy");
        await userEvent.click(await screen.findByRole("button", { name: "Save" }));

        expect(vm.setStatus).toHaveBeenCalledWith({ emoji: "😄", text: "Happy" });
    });

    it("sets a custom status with an emoji chosen from the picker", async () => {
        const vm = new SetStatusViewModel({});
        render(<SetStatusView vm={vm} />);

        await openCustomEditor();

        await userEvent.click(screen.getByRole("button", { name: "Choose Emoji" }));
        // Pick from the always-rendered quick reactions row
        await userEvent.click(await screen.findByText("🤩"));

        await userEvent.type(screen.getByRole("textbox", { name: "What's your status?" }), "Starstruck");
        await userEvent.click(await screen.findByRole("button", { name: "Save" }));

        expect(vm.setStatus).toHaveBeenCalledWith({ emoji: "🤩", text: "Starstruck" });
    });

    it("starts in the custom editor if initialCustomMode is set", async () => {
        const vm = new SetStatusViewModel({});
        render(<SetStatusView vm={vm} initialCustomMode={true} />);

        await userEvent.type(screen.getByRole("textbox", { name: "What's your status?" }), "Happy");
        await userEvent.click(await screen.findByRole("button", { name: "Save" }));

        expect(vm.setStatus).toHaveBeenCalledWith({ emoji: "😄", text: "Happy" });
    });

    it("returns to the set status prompt if the custom editor is cancelled", async () => {
        const vm = new SetStatusViewModel({});
        render(<SetStatusView vm={vm} />);

        await openCustomEditor();

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(vm.setStatus).not.toHaveBeenCalled();
        expect(screen.getByRole("combobox")).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    describe("menu variant", () => {
        const trigger = (): HTMLElement => screen.getByRole("button", { name: "What's your status?" });

        it("shows the statuses as a menu", async () => {
            const vm = new SetStatusViewModel({});
            render(<SetStatusView vm={vm} variant="menu" />);
            expect(trigger()).toHaveAttribute("aria-haspopup", "menu");

            await userEvent.click(trigger());

            expect(screen.getByRole("menu", { name: "What's your status?" })).toBeInTheDocument();
            expect(screen.getByRole("menuitem", { name: "🌴Away" })).toBeInTheDocument();
        });

        it("sets a preset status", async () => {
            const vm = new SetStatusViewModel({});
            render(<SetStatusView vm={vm} variant="menu" />);

            await userEvent.click(trigger());
            await userEvent.click(screen.getByRole("menuitem", { name: "🌴Away" }));

            expect(vm.setStatus).toHaveBeenCalledWith({ emoji: "🌴", text: "Away" });
        });

        it("moves focus to the clear button once a status is picked", async () => {
            const vm = new LiveSetStatusViewModel();
            render(<SetStatusView vm={vm} variant="menu" />);

            await userEvent.click(trigger());
            await userEvent.click(screen.getByRole("menuitem", { name: "🌴Away" }));

            await waitFor(() => expect(screen.getByRole("button", { name: "Clear status" })).toHaveFocus());
        });

        it("opens the custom editor from the menu", async () => {
            const vm = new SetStatusViewModel({});
            render(<SetStatusView vm={vm} variant="menu" />);

            await userEvent.click(trigger());
            await userEvent.click(screen.getByRole("menuitem", { name: "✍️Custom…" }));

            expect(screen.getByRole("textbox", { name: "What's your status?" })).toBeInTheDocument();
        });

        it("does not open when disabled", async () => {
            const vm = new SetStatusViewModel({ disabled: true });
            render(<SetStatusView vm={vm} variant="menu" />);

            await userEvent.click(trigger());

            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        });
    });
});
