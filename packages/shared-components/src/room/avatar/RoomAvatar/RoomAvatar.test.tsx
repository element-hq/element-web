/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../core/viewmodel";
import {
    RoomAvatarView,
    type RoomAvatarViewActions,
    type RoomAvatarViewModel,
    type RoomAvatarViewSnapshot,
} from "./RoomAvatarView";
import * as stories from "./RoomAvatar.stories";

const { Default, SpaceRoom, Clickable } = composeStories(stories);

describe("RoomAvatarView", () => {
    it("renders a round avatar with initial letter", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders a square avatar for a space", () => {
        const { container } = render(<SpaceRoom />);
        expect(container).toMatchSnapshot();
    });

    it("renders a clickable avatar", () => {
        const { container } = render(<Clickable />);
        expect(container).toMatchSnapshot();
    });

    it("invokes the click action when the avatar is clicked", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        class TestRoomAvatarViewModel extends MockViewModel<RoomAvatarViewSnapshot> implements RoomAvatarViewActions {
            public onClick: () => void;

            public constructor(snapshot: RoomAvatarViewSnapshot, actions: RoomAvatarViewActions) {
                super(snapshot);
                this.onClick = actions.onClick;
            }
        }

        const vm = new TestRoomAvatarViewModel(
            {
                name: "Test Room",
                idName: "!room:example.com",
                urls: ["https://example.com/avatar.png"],
                type: "round",
                isClickable: true,
            },
            { onClick },
        ) as RoomAvatarViewModel;

        render(<RoomAvatarView vm={vm} size="36px" />);

        await user.click(screen.getByTestId("avatar-img"));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("cycles to the next URL on image load error", async () => {
        const vm = new MockViewModel<RoomAvatarViewSnapshot>({
            name: "Test Room",
            idName: "!room:example.com",
            urls: ["https://example.com/first.png", "https://example.com/fallback.png"],
            type: "round",
            isClickable: false,
        }) as unknown as RoomAvatarViewModel;

        const { rerender } = render(<RoomAvatarView vm={vm} size="36px" />);

        const avatarImg = screen.getByTestId("avatar-img");

        // Verify initial URL is the first one.
        expect(avatarImg).toHaveAttribute("src", "https://example.com/first.png");

        // Trigger image error to cycle to the fallback URL.
        // Re-render is needed after the event handler updates state.
        avatarImg.dispatchEvent(new Event("error", { bubbles: true }));
        rerender(<RoomAvatarView vm={vm} size="36px" />);

        expect(screen.getByTestId("avatar-img")).toHaveAttribute("src", "https://example.com/fallback.png");
    });
});
