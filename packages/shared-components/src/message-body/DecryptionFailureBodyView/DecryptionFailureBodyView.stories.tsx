/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    DecryptionFailureBodyView,
    DecryptionFailureReason,
    type DecryptionFailureBodyViewSnapshot,
} from "./DecryptionFailureBodyView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type DecryptionFailureBodyProps = DecryptionFailureBodyViewSnapshot;

const DecryptionFailureBodyViewWrapperImpl = ({ ...rest }: DecryptionFailureBodyProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <DecryptionFailureBodyView vm={vm} />;
};
const DecryptionFailureBodyViewWrapper = withViewDocs(DecryptionFailureBodyViewWrapperImpl, DecryptionFailureBodyView);

const meta = {
    title: "MessageBody/DecryptionFailureBodyView",
    component: DecryptionFailureBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
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
        extraClassNames: ["extra_class"],
    },
} satisfies Meta<typeof DecryptionFailureBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HasExtraClassNames: Story = {
    args: {
        decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        extraClassNames: ["extra_class_1", "extra_class_2"],
    },
};

export const HasErrorClassName: Story = {
    args: {
        decryptionFailureReason: DecryptionFailureReason.UNSIGNED_SENDER_DEVICE,
        extraClassNames: undefined,
    },
};

export const HasErrorBlockIcon: Story = {
    args: {
        decryptionFailureReason: DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
        extraClassNames: undefined,
    },
};

export const HasBackupConfiguredVerifiedFalse: Story = {
    args: {
        decryptionFailureReason: DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
        isLocalDeviceVerified: false,
        extraClassNames: undefined,
    },
};

export const HasBackupConfiguredVerifiedTrue: Story = {
    args: {
        decryptionFailureReason: DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
        isLocalDeviceVerified: true,
        extraClassNames: undefined,
    },
};
