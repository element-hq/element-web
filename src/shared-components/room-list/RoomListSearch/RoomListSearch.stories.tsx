/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, useMemo } from "react";
import { fn } from "storybook/test";
import { type Meta, type StoryFn } from "@storybook/react-vite";

import {
    RoomListSearch as RoomListSearchComponent,
    type RoomListSearchSnapshot,
    type RoomListSearchViewModel,
} from "./RoomListSearch";
import { MockViewModel } from "../../MockViewModel";

interface Props extends RoomListSearchSnapshot {
    onSearchClick: MouseEventHandler<HTMLButtonElement>;
    onDialPadClick: MouseEventHandler<HTMLButtonElement>;
    onExploreClick: MouseEventHandler<HTMLButtonElement>;
}

function Wrapper(props: Props): JSX.Element {
    const vm = useMemo(() => {
        const { displayExploreButton, displayDialButton, ...actions } = props;
        const viewModel = new MockViewModel({
            displayExploreButton,
            displayDialButton,
        }) as unknown as RoomListSearchViewModel;
        Object.assign(viewModel, actions);

        return viewModel;
    }, [props]);
    return <RoomListSearchComponent vm={vm} />;
}

export default {
    title: "RoomList/RoomListSearch",
    component: Wrapper,
    tags: ["autodocs"],
    args: {
        displayExploreButton: true,
        displayDialButton: true,
        onSearchClick: fn(),
        onDialPadClick: fn(),
        onExploreClick: fn(),
    },
    decorators: [
        (Story) => (
            <div style={{ display: "flex", flexDirection: "column" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof Wrapper>;

const Template: StoryFn<typeof Wrapper> = (args) => <Wrapper {...args} />;

export const Default = Template.bind({});

export const HideExploreButton = Template.bind({});
HideExploreButton.args = {
    displayExploreButton: false,
};

export const HideDialButton = Template.bind({});
HideDialButton.args = {
    displayDialButton: false,
};

export const HideAllButtons = Template.bind({});
HideAllButtons.args = {
    displayExploreButton: false,
    displayDialButton: false,
};
