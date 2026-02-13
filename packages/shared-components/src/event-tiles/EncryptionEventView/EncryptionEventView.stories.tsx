/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { EncryptionEventView, EncryptionState, type EncryptionEventViewSnapshot } from "./EncryptionEventView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";

type EncryptionEventProps = EncryptionEventViewSnapshot;

const EncryptionEventViewWrapper = ({ ...rest }: EncryptionEventProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <EncryptionEventView vm={vm} />;
};

export default {
    title: "Event/EncryptionEvent",
    component: EncryptionEventViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        state: {
            options: Object.entries(EncryptionState)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
    },
    args: {
        state: EncryptionState.ENABLED,
        simplified: false,
        userName: "Alice",
        className: "",
    },
} as Meta<typeof EncryptionEventViewWrapper>;

const Template: StoryFn<typeof EncryptionEventViewWrapper> = (args) => <EncryptionEventViewWrapper {...args} />;

export const Default = Template.bind({});
