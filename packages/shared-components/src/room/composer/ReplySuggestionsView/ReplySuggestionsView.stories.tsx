/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    ReplySuggestionsView,
    type ReplySuggestionsViewActions,
    type ReplySuggestionsViewSnapshot,
} from "./ReplySuggestionsView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type ReplySuggestionsProps = ReplySuggestionsViewSnapshot & ReplySuggestionsViewActions;

const ReplySuggestionsViewWrapperImpl = ({ onSuggestionClick, ...rest }: ReplySuggestionsProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onSuggestionClick });
    return <ReplySuggestionsView vm={vm} />;
};
const ReplySuggestionsViewWrapper = withViewDocs(ReplySuggestionsViewWrapperImpl, ReplySuggestionsView);

const meta = {
    title: "Room/Composer/ReplySuggestionsView",
    component: ReplySuggestionsViewWrapper,
    tags: ["autodocs"],
    args: {
        suggestions: [
            "Sounds good, see you then!",
            "Can we make it Thursday instead?",
            "I'll check and get back to you",
        ],
        loading: false,
        onSuggestionClick: fn(),
    },
} satisfies Meta<typeof ReplySuggestionsViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
    args: {
        suggestions: [],
        loading: true,
    },
};

export const LongSuggestions: Story = {
    args: {
        suggestions: [
            "That sounds like a great plan, I'll bring the slides and the demo build with me on Friday",
            "Can we move it to next week? I'm travelling until Wednesday and won't have my laptop",
            "Sure",
        ],
    },
};
