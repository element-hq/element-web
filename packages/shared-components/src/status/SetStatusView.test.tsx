/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { Menu } from "@vector-im/compound-web";

import { SetStatusView, type SetStatusViewActions, type SetStatusViewSnapshot } from "./SetStatusView";
import { MockViewModel } from "../core/viewmodel/MockViewModel";

class SetStatusViewModel extends MockViewModel<SetStatusViewSnapshot> implements SetStatusViewActions {
    public setStatus = vi.fn();
    public clearStatus = vi.fn();
}

class CustomClickSetStatusViewModel extends SetStatusViewModel {
    public onSetCustomStatusClick = vi.fn();
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

    describe("submenu variant", () => {
        function renderInMenu(vm: SetStatusViewModel): void {
            render(
                <Menu open={true} onOpenChange={vi.fn()} title="Menu" trigger={<button>Open</button>}>
                    <SetStatusView vm={vm} variant="submenu" />
                </Menu>,
            );
        }

        async function openSubMenu(): Promise<void> {
            await userEvent.click(screen.getByRole("menuitem", { name: "What's your status?" }));
        }

        it("renders the trigger as a submenu item", () => {
            renderInMenu(new SetStatusViewModel({}));

            const trigger = screen.getByRole("menuitem", { name: "What's your status?" });
            expect(trigger).toHaveAttribute("aria-haspopup", "menu");
            expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        });

        it("lists every status in the submenu", async () => {
            renderInMenu(new SetStatusViewModel({}));

            await openSubMenu();

            for (const name of ["In a meeting", "Focus Time", "On the road", "Be right back", "Away", "Custom…"]) {
                expect(await screen.findByRole("menuitem", { name })).toBeInTheDocument();
            }
        });

        it("opens on click rather than hover, and closes on a second click", async () => {
            renderInMenu(new SetStatusViewModel({}));
            const trigger = screen.getByRole("menuitem", { name: "What's your status?" });

            await userEvent.hover(trigger);
            // Longer than the hover-open delay
            await new Promise((r) => setTimeout(r, 200));
            expect(trigger).toHaveAttribute("aria-expanded", "false");

            await userEvent.click(trigger);
            expect(await screen.findByRole("menuitem", { name: "Away" })).toBeInTheDocument();

            await userEvent.click(trigger);
            expect(trigger).toHaveAttribute("aria-expanded", "false");
        });

        it("sets a preset status when one is selected", async () => {
            const vm = new SetStatusViewModel({});
            renderInMenu(vm);

            await openSubMenu();
            await userEvent.click(await screen.findByRole("menuitem", { name: "Away" }));

            expect(vm.setStatus).toHaveBeenCalledWith({ emoji: "🌴", text: "Away" });
        });

        it("calls onSetCustomStatusClick when custom is selected", async () => {
            const vm = new CustomClickSetStatusViewModel({});
            renderInMenu(vm);

            await openSubMenu();
            await userEvent.click(await screen.findByRole("menuitem", { name: "Custom…" }));

            expect(vm.onSetCustomStatusClick).toHaveBeenCalled();
            expect(vm.setStatus).not.toHaveBeenCalled();
        });

        it("does not offer a submenu when disabled", () => {
            renderInMenu(new SetStatusViewModel({ disabled: true }));

            expect(screen.queryByRole("menuitem", { name: "What's your status?" })).not.toBeInTheDocument();
            expect(screen.getByLabelText("What's your status?")).toHaveAttribute("aria-disabled", "true");
        });

        it("shows the current status instead of the submenu", () => {
            renderInMenu(new SetStatusViewModel({ userStatus: { emoji: "🦩", text: "Flamboyant" } }));

            expect(screen.queryByRole("menuitem", { name: "What's your status?" })).not.toBeInTheDocument();
            expect(screen.getByText("Flamboyant")).toBeInTheDocument();
        });
    });
});
