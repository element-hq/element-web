/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { SetStatusView, type SetStatusViewActions, type SetStatusViewSnapshot } from "./SetStatusView";
import { useMockedViewModel } from "../core/viewmodel";
import { withViewDocs } from "../../.storybook/withViewDocs";

const SetStatusViewWrapperImpl = ({
    setStatus,
    clearStatus,
    ...snapshot
}: SetStatusViewSnapshot & SetStatusViewActions): JSX.Element => {
    const vm = useMockedViewModel<SetStatusViewSnapshot, SetStatusViewActions>(snapshot, {
        setStatus,
        clearStatus,
    });
    return <SetStatusView vm={vm} />;
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
