/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, afterEach, expect } from "vitest";

import { ComposeMenuView } from "./ComposeMenuView";
import { defaultSnapshot, MockedViewModel } from "../test-utils";

describe("<ComposeMenuView />", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should match snapshot", () => {
        const vm = new MockedViewModel(defaultSnapshot);
        const { asFragment } = render(<ComposeMenuView vm={vm} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should display all menu options when fully enabled", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<ComposeMenuView vm={vm} />);

        // Open the menu
        const button = screen.getByRole("button", { name: "New conversation" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Start chat" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "New room" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "New video room" })).toBeInTheDocument();
    });

    it("should hide new room option when canCreateRoom is false", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, canCreateRoom: false });
        render(<ComposeMenuView vm={vm} />);

        const button = screen.getByRole("button", { name: "New conversation" });
        await user.click(button);

        expect(screen.queryByRole("menuitem", { name: "New room" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Start chat" })).toBeInTheDocument();
    });

    it("should hide video room option when canCreateVideoRoom is false", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, canCreateVideoRoom: false });
        render(<ComposeMenuView vm={vm} />);

        const button = screen.getByRole("button", { name: "New conversation" });
        await user.click(button);

        expect(screen.queryByRole("menuitem", { name: "New video room" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Start chat" })).toBeInTheDocument();
    });

    it("should call createChatRoom when Start chat is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<ComposeMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "New conversation" }));
        await user.click(screen.getByRole("menuitem", { name: "Start chat" }));

        expect(vm.createChatRoom).toHaveBeenCalledTimes(1);
    });

    it("should call createRoom when New room is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<ComposeMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "New conversation" }));
        await user.click(screen.getByRole("menuitem", { name: "New room" }));

        expect(vm.createRoom).toHaveBeenCalledTimes(1);
    });

    it("should call createVideoRoom when New video room is clicked", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<ComposeMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "New conversation" }));
        await user.click(screen.getByRole("menuitem", { name: "New video room" }));

        expect(vm.createVideoRoom).toHaveBeenCalledTimes(1);
    });
});
