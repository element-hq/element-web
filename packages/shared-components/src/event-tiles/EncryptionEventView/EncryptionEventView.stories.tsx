/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { EncryptionEventView, EncryptionEventState, type EncryptionEventViewSnapshot } from "./EncryptionEventView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type EncryptionEventProps = EncryptionEventViewSnapshot;

const EncryptionEventViewWrapperImpl = ({ className, ...rest }: EncryptionEventProps & { className?: string }): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <EncryptionEventView vm={vm} className={className} />;
};
const EncryptionEventViewWrapper = withViewDocs(EncryptionEventViewWrapperImpl, EncryptionEventView);

const meta = {
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
} satisfies Meta<typeof EncryptionEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StateEncryptionEnabled: Story = {
    args: {
        state: EncryptionEventState.ENABLED,
        encryptedStateEvents: true,
    },
};

export const ParametersChanged: Story = {
    args: {
        state: EncryptionEventState.CHANGED,
    },
};

export const DisableAttempt: Story = {
    args: {
        state: EncryptionEventState.DISABLE_ATTEMPT,
    },
};

export const EnabledDirectMessage: Story = {
    args: {
        state: EncryptionEventState.ENABLED_DM,
        userName: "Alice",
    },
};

export const EnabledLocalRoom: Story = {
    args: {
        state: EncryptionEventState.ENABLED_LOCAL,
    },
};

export const Unsupported: Story = {
    args: {
        state: EncryptionEventState.UNSUPPORTED,
    },
};

export const WithTimestamp: Story = {
    args: {
        state: EncryptionEventState.ENABLED,
        timestamp: <span>14:56</span>,
    },
};
