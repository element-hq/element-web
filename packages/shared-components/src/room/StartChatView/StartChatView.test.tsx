/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import { userEvent } from "vitest/browser";

import * as stories from "./StartChatView.stories";
import { MockViewModel } from "../../core/viewmodel";
import { StartChatView, type StartChatViewModel, type StartChatViewSnapshot } from "./StartChatView";

const { DirectMessage } = composeStories(stories);

describe("<StartChatView />", () => {
    it("renders DirectMessage", () => {
        const { container } = render(<DirectMessage />);
        expect(container).toMatchSnapshot();
    });

    class ViewModel extends MockViewModel<StartChatViewSnapshot> {
        public constructor() {
            super({
                isEncrypted: true,
                roomName: "Alice",
                dmName: "Alice",
                canInvite: true,
                isFavourite: false,
                type: "public_room",
            });
        }
    }

    let vm: StartChatViewModel;
    beforeEach(() => {
        vm = new ViewModel() as unknown as StartChatViewModel;
        Object.assign(vm, {
            getAvatar: () => <div style={{ width: 88, height: 88, backgroundColor: "grey", borderRadius: "100%" }} />,
            toggleFavourite: vi.fn(),
            openNotifications: vi.fn(),
            invite: vi.fn(),
        });
    });

    it("should call Toggle favourite", async () => {
        const user = userEvent.setup();

        render(<StartChatView vm={vm} />);

        const toggleFavouriteButton = screen.getByRole("switch", { name: "Add to favourites" });
        await user.click(toggleFavouriteButton);

        expect(vm.toggleFavourite).toHaveBeenCalled();
    });

    it("should call Open notifications", async () => {
        const user = userEvent.setup();

        render(<StartChatView vm={vm} />);

        const notificationsButton = screen.getByRole("button", { name: "Notifications" });
        await user.click(notificationsButton);

        expect(vm.openNotifications).toHaveBeenCalled();
    });

    it("should call Invite", async () => {
        const user = userEvent.setup();

        render(<StartChatView vm={vm} />);

        const inviteButton = screen.getByRole("button", { name: "Invite people" });
        await user.click(inviteButton);

        expect(vm.invite).toHaveBeenCalled();
    });
});
