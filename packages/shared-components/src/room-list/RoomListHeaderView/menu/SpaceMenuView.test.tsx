/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { SpaceMenuView } from "./SpaceMenuView";
import { defaultSnapshot, MockedViewModel } from "../test-utils";

describe("<SpaceMenuView />", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should match snapshot", () => {
        const vm = new MockedViewModel(defaultSnapshot);
        const { asFragment } = render(<SpaceMenuView vm={vm} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the menu when button is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<SpaceMenuView vm={vm} />);

        const button = screen.getByRole("button", { name: "Open space menu" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Space home" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Preferences" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Space settings" })).toBeInTheDocument();
    });

    it("should hide invite option when canInviteInSpace is false", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, canInviteInSpace: false });
        render(<SpaceMenuView vm={vm} />);

        const button = screen.getByRole("button", { name: "Open space menu" });
        await user.click(button);

        expect(screen.queryByRole("menuitem", { name: "Invite" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Space home" })).toBeInTheDocument();
    });

    it("should hide space settings option when canAccessSpaceSettings is false", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, canAccessSpaceSettings: false });
        render(<SpaceMenuView vm={vm} />);

        const button = screen.getByRole("button", { name: "Open space menu" });
        await user.click(button);

        expect(screen.queryByRole("menuitem", { name: "Space settings" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Space home" })).toBeInTheDocument();
    });

    it("should call openSpaceHome when Home is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<SpaceMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Open space menu" }));
        await user.click(screen.getByRole("menuitem", { name: "Space home" }));

        expect(vm.openSpaceHome).toHaveBeenCalledTimes(1);
    });

    it("should call inviteInSpace when Invite is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<SpaceMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Open space menu" }));
        await user.click(screen.getByRole("menuitem", { name: "Invite" }));

        expect(vm.inviteInSpace).toHaveBeenCalledTimes(1);
    });

    it("should call openSpacePreferences when Preferences is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<SpaceMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Open space menu" }));
        await user.click(screen.getByRole("menuitem", { name: "Preferences" }));

        expect(vm.openSpacePreferences).toHaveBeenCalledTimes(1);
    });

    it("should call openSpaceSettings when Space settings is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<SpaceMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Open space menu" }));
        await user.click(screen.getByRole("menuitem", { name: "Space settings" }));

        expect(vm.openSpaceSettings).toHaveBeenCalledTimes(1);
    });
});
