/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { EncryptionEventView, EncryptionEventState, type EncryptionEventViewSnapshot } from "./EncryptionEventView";
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
            options: Object.entries(EncryptionEventState)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
    },
    args: {
        state: EncryptionEventState.ENABLED,
        encryptedStateEvents: false,
        userName: "Alice",
        className: "",
    },
} as Meta<typeof EncryptionEventViewWrapper>;

const Template: StoryFn<typeof EncryptionEventViewWrapper> = (args) => <EncryptionEventViewWrapper {...args} />;

export const Default = Template.bind({});

export const StateEncryptionEnabled = Template.bind({});
StateEncryptionEnabled.args = {
    state: EncryptionEventState.ENABLED,
    encryptedStateEvents: true,
};

export const ParametersChanged = Template.bind({});
ParametersChanged.args = {
    state: EncryptionEventState.CHANGED,
};

export const DisableAttempt = Template.bind({});
DisableAttempt.args = {
    state: EncryptionEventState.DISABLE_ATTEMPT,
};

export const EnabledDirectMessage = Template.bind({});
EnabledDirectMessage.args = {
    state: EncryptionEventState.ENABLED_DM,
    userName: "Alice",
};

export const EnabledLocalRoom = Template.bind({});
EnabledLocalRoom.args = {
    state: EncryptionEventState.ENABLED_LOCAL,
};

export const Unsupported = Template.bind({});
Unsupported.args = {
    state: EncryptionEventState.UNSUPPORTED,
};

export const WithTimestamp = Template.bind({});
WithTimestamp.args = {
    state: EncryptionEventState.ENABLED,
    timestamp: <span>14:56</span>,
};
