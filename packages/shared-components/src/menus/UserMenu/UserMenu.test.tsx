/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen, waitFor } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./UserMenu.stories.tsx";

const { Default, LongerName, Condensed, Guest, Open, NoAvatar, WithStatus, WithStatusOpen, WithStatusDropdownOpen } =
    composeStories(stories);

describe("UserMenu", () => {
    it("renders a button", async () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a button with a longer name", async () => {
        const { container } = render(<LongerName />);
        expect(container).toMatchSnapshot();
    });
    it("renders condensed view", async () => {
        const { container } = render(<Condensed />);
        expect(container).toMatchSnapshot();
    });
    it("renders the status emoji when set", async () => {
        const { container } = render(<WithStatus />);
        expect(container).toMatchSnapshot();
    });
    it("renders a menu", async () => {
        const { baseElement, getByRole } = render(<Default />);
        await userEvent.click(getByRole("button"));
        expect(baseElement).toMatchSnapshot();
    });
    it("renders a guest menu", async () => {
        const { baseElement, getByRole } = render(<Guest />);
        await userEvent.click(getByRole("button"));
        expect(baseElement).toMatchSnapshot();
    });
    it("renders an open menu", async () => {
        const { baseElement } = render(<Open />);
        expect(baseElement).toMatchSnapshot();
    });
    it("renders a menu without an avatar", async () => {
        const { baseElement } = render(<NoAvatar />);
        expect(baseElement).toMatchSnapshot();
    });
    it("renders an open menu with user status", async () => {
        const { container } = render(<WithStatusOpen />);
        expect(container).toMatchSnapshot();
    });

    describe("set status", () => {
        // The user menu may not be visible on the first frame while it is positioned
        const trigger = (): Promise<HTMLElement> => screen.findByRole("button", { name: "What's your status?" });
        const away = (): HTMLElement | null => screen.queryByRole("menuitem", { name: "🌴Away" });

        it("opens the status choices as a menu beside the user menu", async () => {
            render(<WithStatusDropdownOpen />);
            const button = await trigger();
            expect(button).toHaveAttribute("aria-haspopup", "menu");

            await userEvent.click(button);

            expect(away()).toBeVisible();
            // (The status menu is modal, so the trigger is now hidden from queries)
            expect(button).toHaveAttribute("aria-expanded", "true");
        });

        it("sets a status and leaves the user menu open", async () => {
            render(<WithStatusDropdownOpen />);
            const setStatus = WithStatusDropdownOpen.args.setStatusViewModel!.setStatus;

            await userEvent.click(await trigger());
            await userEvent.click(away()!);

            expect(setStatus).toHaveBeenCalledWith({ emoji: "🌴", text: "Away" });
            await waitFor(() => expect(away()).not.toBeInTheDocument());
            expect(screen.getByRole("menuitem", { name: "All settings" })).toBeVisible();
        });

        it("closes only the status menu on Escape", async () => {
            render(<WithStatusDropdownOpen />);
            await userEvent.click(await trigger());

            await userEvent.keyboard("{Escape}");

            await waitFor(() => expect(away()).not.toBeInTheDocument());
            expect(screen.getByRole("menuitem", { name: "All settings" })).toBeVisible();
        });
    });
});
