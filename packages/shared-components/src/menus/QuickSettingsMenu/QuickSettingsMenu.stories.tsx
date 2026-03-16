/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle";

import {
    QuickSettingsMenu,
    type QuickSettingsMenuSnapshot,
    type QuickSettingsMenuViewActions,
} from "./QuickSettingsMenu";
import avatarUrl from "../../../static/element.png";
import { BaseViewModel, useCreateAutoDisposedViewModel } from "../../viewmodel";

class MockQuickSettingsViewModel
    extends BaseViewModel<QuickSettingsMenuSnapshot, undefined>
    implements QuickSettingsMenuViewActions
{
    public constructor(snapshot: QuickSettingsMenuSnapshot) {
        super(undefined, snapshot);
    }

    public setOpen = (open: boolean): void => {
        this.snapshot.merge({ open });
    };
}

const QuickSettingsMenuWrapper = (snapshot: QuickSettingsMenuSnapshot): JSX.Element => {
    const vm = useCreateAutoDisposedViewModel(() => new MockQuickSettingsViewModel(snapshot));
    return <QuickSettingsMenu vm={vm} />;
};

const meta = {
    title: "Menus/QuickSettingsMenu",
    component: QuickSettingsMenuWrapper,
    tags: ["autodocs"],
    args: {
        open: false,
        avatarUrl,
        displayName: "Sally Sanderson",
        userId: "@person-name:homeserver.com",
        manageAccountHref: "#",
        expanded: true,
        actions: [
            {
                icon: CheckCircleIcon,
                label: "One action",
                onSelect: fn(),
            },
            {
                icon: CheckCircleIcon,
                label: "Another action",
                onSelect: fn(),
            },
            {
                icon: CheckCircleIcon,
                label: "Third action",
                onSelect: fn(),
            },
        ],
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11583-3479&t=DwFpi7Zlq9uJr1SQ-0",
        },
    },
} satisfies Meta<typeof QuickSettingsMenuWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongerName: Story = {
    args: {
        displayName: "Sally Sanderson with a longer name",
    },
};

export const AlreadyOpen: Story = {
    args: {
        open: true,
        displayName: "Sally Sanderson with a longer name",
        userId: "@person-name:homeserver.com",
        expanded: true,
    },
};

export const Condensed: Story = {
    args: {
        displayName: "Sally Sanderson with a longer name",
        expanded: false,
    },
};
