/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { Menu } from "@vector-im/compound-web";

import {
    SetStatusView,
    type SetStatusViewActions,
    type SetStatusViewProps,
    type SetStatusViewSnapshot,
} from "./SetStatusView";
import { useMockedViewModel } from "../core/viewmodel";
import { withViewDocs } from "../../.storybook/withViewDocs";

const SetStatusViewWrapperImpl = ({
    setStatus,
    clearStatus,
    variant,
    ...snapshot
}: SetStatusViewSnapshot & SetStatusViewActions & Pick<SetStatusViewProps, "variant">): JSX.Element => {
    const vm = useMockedViewModel<SetStatusViewSnapshot, SetStatusViewActions>(snapshot, {
        setStatus,
        clearStatus,
    });
    return <SetStatusView vm={vm} variant={variant} />;
};

const SetStatusViewWrapper = withViewDocs(SetStatusViewWrapperImpl, SetStatusView);

const meta = {
    title: "Status/SetStatusView",
    component: SetStatusViewWrapper,
    tags: ["autodocs"],
    args: {
        setStatus: fn(),
        clearStatus: fn(),
    },
} satisfies Meta<typeof SetStatusViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoStatus: Story = {};

export const WithStatus: Story = {
    args: {
        userStatus: { emoji: "🦩", text: "Flamboyant" },
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
};

// Rules needed for any story where the menu is open.
const MENU_OPEN_A11Y_RULES = [
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
];

/**
 * The `submenu` variant, as used inside a menu such as the user menu.
 */
export const InMenu: Story = {
    render: (args) => (
        <Menu open={true} onOpenChange={fn()} title="Menu" showTitle={false} trigger={<button>Menu</button>}>
            <SetStatusViewWrapperImpl {...args} variant="submenu" />
        </Menu>
    ),
    parameters: {
        a11y: {
            config: {
                rules: MENU_OPEN_A11Y_RULES,
            },
        },
    },
    tags: ["!autodocs"],
};

export const Open: Story = {
    parameters: {
        a11y: {
            config: {
                rules: MENU_OPEN_A11Y_RULES,
            },
        },
    },
    tags: ["!dev", "!autodocs"],
};
