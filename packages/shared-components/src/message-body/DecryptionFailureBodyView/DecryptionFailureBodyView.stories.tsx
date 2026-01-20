/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
import { mkMatrixEvent, mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { DecryptionFailureBodyView, type DecryptionFailureBodyViewSnapshot } from "./DecryptionFailureBodyView";
import { useMockedViewModel } from "../../useMockedViewModel";
import { LocalDeviceVerificationStateContext } from "../../utils/LocalDeviceVerificationStateContext";

type DecryptionFailureBodyProps = DecryptionFailureBodyViewSnapshot;

const DecryptionFailureBodyViewWrapper = ({
    ...rest
}: DecryptionFailureBodyProps & { localDeviceVerificationStateContext: boolean }): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return (
        <LocalDeviceVerificationStateContext.Provider value={rest.localDeviceVerificationStateContext}>
            <DecryptionFailureBodyView vm={vm} />
        </LocalDeviceVerificationStateContext.Provider>
    );
};

export default {
    title: "MessageBody/DecryptionFailureBodyView",
    component: DecryptionFailureBodyView,
    tags: ["autodocs"],
    argTypes: {
        vm: { table: { disable: true } },
    },
    args: {
        className: "custom-class",
        ref: undefined,
        localDeviceVerificationStateContext: true,
    },
} as Meta<typeof DecryptionFailureBodyView>;

const Template: StoryFn<typeof DecryptionFailureBodyViewWrapper> = (args, { loaded }) => (
    <DecryptionFailureBodyViewWrapper {...args} mxEvent={loaded.mxEvent} />
);

export const Default = Template.bind({});
Default.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const UnableToDecrypt = Template.bind({});
UnableToDecrypt.loaders = [
    async () => ({
        mxEvent: mkMatrixEvent({
            type: "m.room.message",
            roomId: "myfakeroom",
            sender: "myfakeuser",
            content: {
                msgtype: "m.bad.encrypted",
            },
        }),
    }),
];

export const BlockedFromReceiving = Template.bind({});
BlockedFromReceiving.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const NoBackupKey = Template.bind({});
NoBackupKey.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const LocalDeviceNotVerified = Template.bind({});
LocalDeviceNotVerified.args = {
    localDeviceVerificationStateContext: false,
};
LocalDeviceNotVerified.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const PreJoinMessages = Template.bind({});
PreJoinMessages.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const UserChangeIdentity = Template.bind({});
UserChangeIdentity.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];

export const MessageFromUnverifiedDevice = Template.bind({});
MessageFromUnverifiedDevice.loaders = [
    async () => ({
        mxEvent: await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.UNSIGNED_SENDER_DEVICE,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        }),
    }),
];
