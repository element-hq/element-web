/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    DecryptionFailureBodyView,
    DecryptionFailureReason,
    type DecryptionFailureBodyViewSnapshot,
} from "./DecryptionFailureBodyView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";

type DecryptionFailureBodyProps = DecryptionFailureBodyViewSnapshot;

const DecryptionFailureBodyViewWrapper = ({ ...rest }: DecryptionFailureBodyProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <DecryptionFailureBodyView vm={vm} />;
};

export default {
    title: "MessageBody/DecryptionFailureBodyView",
    component: DecryptionFailureBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        vm: { table: { disable: true } },
        decryptionFailureReason: {
            options: Object.entries(DecryptionFailureReason)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
    },
    args: {
        decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        isLocalDeviceVerified: true,
        extraClassNames: ["custom-class"],
    },
} as Meta<typeof DecryptionFailureBodyViewWrapper>;

const Template: StoryFn<typeof DecryptionFailureBodyViewWrapper> = (args) => (
    <DecryptionFailureBodyViewWrapper {...args} />
);

export const Default = Template.bind({});

export const HasErrorClassName = Template.bind({});
HasErrorClassName.args = {
    decryptionFailureReason: DecryptionFailureReason.UNSIGNED_SENDER_DEVICE,
    extraClassNames: undefined,
};

export const HasErrorBlockIcon = Template.bind({});
HasErrorBlockIcon.args = {
    decryptionFailureReason: DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
    extraClassNames: undefined,
};

export const HasBackupConfiguredVerifiedFalse = Template.bind({});
HasBackupConfiguredVerifiedFalse.args = {
    decryptionFailureReason: DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
    isLocalDeviceVerified: false,
    extraClassNames: undefined,
};

export const HasBackupConfiguredVerifiedTrue = Template.bind({});
HasBackupConfiguredVerifiedTrue.args = {
    decryptionFailureReason: DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
    isLocalDeviceVerified: true,
    extraClassNames: undefined,
};
