/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { UserMenuView, type UserMenuViewSnapshot, type UserMenuViewActions } from "./UserMenu";
import avatarUrl from "../../../static/element.png";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

const UserMenuWrapperImpl = (snapshot: UserMenuViewSnapshot): JSX.Element => {
    const vm = useMockedViewModel<UserMenuViewSnapshot, UserMenuViewActions>(snapshot, {
        setOpen: fn(),
        createAccount: fn(),
        signIn: fn(),
        linkNewDevice: fn(),
        openFeedback: fn(),
        openHomePage: fn(),
        openSecurity: fn(),
        openSettings: fn(),
    });
    return <UserMenuView vm={vm} />;
};

const UserMenuWrapper = withViewDocs(UserMenuWrapperImpl, UserMenuView);

const meta = {
    title: "Menus/UserMenu",
    component: UserMenuWrapper,
    tags: ["autodocs"],
    args: {
        open: false,
        avatarUrl,
        displayName: "Sally Sanderson",
        userId: "@person-name:homeserver.com",
        manageAccountHref: "#",
        expanded: true,
        actions: {
            linkNewDevice: true,
            openSecurity: true,
            openFeedback: true,
            openSettings: true,
        },
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11583-3479&t=DwFpi7Zlq9uJr1SQ-0",
        },
    },
} satisfies Meta<typeof UserMenuWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongerName: Story = {
    args: {
        displayName: "Sally Sanderson with a longer name",
    },
};

export const Open: Story = {
    args: {
        open: true,
        displayName: "Sally Sanderson with a longer name",
        userId: "@person-name:homeserver.com",
        expanded: true,
        showAvatar: true,
    },
    parameters: {
        a11y: {
            /*
             * Axe's context parameter
             * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
             * to learn more.
             */
            config: {
                rules: [
                    {
                        // Menu contains a header which is invalid
                        id: "aria-required-children",
                        enabled: false,
                    },
                    {
                        // Menu pops open by default
                        id: "aria-hidden-focus",
                        enabled: false,
                    },
                ],
            },
        },
    },
    // Only used for playwright tests for the menu.
    // Steals focus if actually opened on the storybook page
    tags: ["!dev", "!autodocs"],
};

export const Condensed: Story = {
    args: {
        displayName: "Sally Sanderson with a longer name",
        expanded: false,
    },
};

export const Guest: Story = {
    args: {
        displayName: "Guest",
        userId: "@guest:attendees.example.org",
        manageAccountHref: undefined,
        showAvatar: false,
        actions: {
            createAccount: true,
            signIn: true,
            openHomePage: true,
            openFeedback: true,
            openSettings: true,
        },
    },
};

export const GuestOpen: Story = {
    args: {
        ...Guest.args,
        open: true,
    },
    parameters: {
        a11y: {
            /*
             * Axe's context parameter
             * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
             * to learn more.
             */
            config: {
                rules: [
                    {
                        // Menu contains a header which is invalid
                        id: "aria-required-children",
                        enabled: false,
                    },
                    {
                        // Menu pops open by default
                        id: "aria-hidden-focus",
                        enabled: false,
                    },
                ],
            },
        },
    },
    // Only used for playwright tests for the menu.
    // Steals focus if actually opened on the storybook page
    tags: ["!dev", "!autodocs"],
};

export const AllOptions: Story = {
    args: {
        displayName: "Alice",
        userId: "@alice:example.org",
        manageAccountHref: "#",
        showAvatar: true,
        actions: {
            createAccount: true,
            signIn: true,
            linkNewDevice: true,
            openSecurity: true,
            openHomePage: true,
            openFeedback: true,
            openSettings: true,
        } satisfies Record<keyof UserMenuViewSnapshot["actions"], true>,
    },
};
