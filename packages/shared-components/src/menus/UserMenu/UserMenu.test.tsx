/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// The layout test below needs Compound's spacing tokens
import "@vector-im/compound-design-tokens/assets/web/css/compound-design-tokens.css";
import { composeStories } from "@storybook/react-vite";
import { render } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./UserMenu.stories.tsx";

const { Default, LongerName, Condensed, Guest, Open, NoAvatar, WithStatus, WithStatusOpen } = composeStories(stories);

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
    it("centers the avatar on the same axis as the space panel's space avatars", async () => {
        // The space panel's 32px space avatars start 18px from its edge
        const spaceAvatarCenter = 18 + 32 / 2;
        const { container, getByRole } = render(<Condensed />);
        const avatar = getByRole("button", { name: "User menu" }).firstElementChild!.firstElementChild!;

        const avatarBox = avatar.getBoundingClientRect();
        const menuStart = container.firstElementChild!.getBoundingClientRect().left;
        expect(avatarBox.left - menuStart + avatarBox.width / 2).toBe(spaceAvatarCenter);
    });
});
