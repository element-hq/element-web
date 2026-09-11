/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import * as stories from "./ForwardDialogView.stories";
import {
    ForwardDialogView,
    type ForwardDialogRoom,
    type ForwardDialogViewActions,
    type ForwardDialogViewSnapshot,
} from "./ForwardDialogView";
import { MockViewModel } from "../../core/viewmodel/MockViewModel";

const { Default, SendStates, Truncated, NoResults } = composeStories(stories);

describe("ForwardDialogView", () => {
    describe("Storybook snapshots", () => {
        it.each([
            ["the default list", Default],
            ["every send state", SendStates],
            ["a truncated list", Truncated],
            ["no results", NoResults],
        ])("renders %s", (_name, Story) => {
            const { container } = render(<Story />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("interactions", () => {
        const makeRoom = (id: string, overrides: Partial<ForwardDialogRoom> = {}): ForwardDialogRoom => ({
            id,
            name: id,
            description: "",
            canSend: true,
            sendState: "can_send",
            ...overrides,
        });

        const renderView = (snapshot: Partial<ForwardDialogViewSnapshot> = {}) => {
            const actions: ForwardDialogViewActions = {
                search: vi.fn(),
                send: vi.fn(),
                openRoom: vi.fn(),
                showAllRooms: vi.fn(),
                renderRoomAvatar: vi.fn().mockReturnValue(<span>avatar</span>),
            };
            const vm = new MockViewModel<ForwardDialogViewSnapshot>({
                rooms: [makeRoom("Alpha"), makeRoom("Bravo", { canSend: false }), makeRoom("Charlie")],
                truncateAt: 20,
                ...snapshot,
            });
            Object.assign(vm, actions);
            render(<ForwardDialogView vm={vm as any} preview={<div>preview</div>} />);
            return actions;
        };

        it("passes the search query to the view model", async () => {
            const actions = renderView();

            await userEvent.type(screen.getByRole("searchbox"), "al");

            expect(actions.search).toHaveBeenLastCalledWith("al");
        });

        it("sends when the Send button is clicked, without opening the room", async () => {
            const actions = renderView();

            await userEvent.click(screen.getAllByRole("button", { name: "Send" })[0]);

            expect(actions.send).toHaveBeenCalledWith("Alpha");
            expect(actions.openRoom).not.toHaveBeenCalled();
        });

        it("opens the room when the row is clicked", async () => {
            const actions = renderView();

            await userEvent.click(screen.getByRole("option", { name: "Charlie" }));

            expect(actions.openRoom).toHaveBeenCalledWith("Charlie", false);
            expect(actions.send).not.toHaveBeenCalled();
        });

        it("disables sending to rooms without permission", () => {
            renderView();

            const [alpha, bravo] = screen.getAllByRole("option");
            expect(alpha.querySelector("button")).not.toHaveAttribute("aria-disabled", "true");
            expect(bravo.querySelector("button")).toHaveAttribute("aria-disabled", "true");
        });

        it("moves focus into the list on ArrowDown from the search input", async () => {
            renderView();

            const search = screen.getByRole("searchbox");
            search.focus();
            await userEvent.keyboard("[ArrowDown]");

            expect(screen.getByRole("option", { name: "Alpha" })).toHaveFocus();
        });

        it("reveals hidden rooms from the overflow item", async () => {
            const actions = renderView({ truncateAt: 1 });

            expect(screen.getAllByRole("option")).toHaveLength(2);
            await userEvent.click(screen.getByRole("option", { name: "and 2 others..." }));

            expect(actions.showAllRooms).toHaveBeenCalled();
        });
    });
});
