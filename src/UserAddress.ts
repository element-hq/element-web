/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const emailRegex = /^\S+@\S+\.\S+$/;
const mxUserIdRegex = /^@\S+:\S+$/;
const mxRoomIdRegex = /^!\S+:\S+$/;

export enum AddressType {
    Email = "email",
    MatrixUserId = "mx-user-id",
    MatrixRoomId = "mx-room-id",
}

export function getAddressType(inputText: string): AddressType | null {
    if (emailRegex.test(inputText)) {
        return AddressType.Email;
    } else if (mxUserIdRegex.test(inputText)) {
        return AddressType.MatrixUserId;
    } else if (mxRoomIdRegex.test(inputText)) {
        return AddressType.MatrixRoomId;
    } else {
        return null;
    }
}
