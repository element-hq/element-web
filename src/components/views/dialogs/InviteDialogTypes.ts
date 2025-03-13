/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum InviteKind {
    Dm = "dm",
    Invite = "invite",
    // NB. This dialog needs the 'mx_InviteDialog_transferWrapper' wrapper class to have the correct
    // padding on the bottom (because all modals have 24px padding on all sides), so this needs to
    // be passed when creating the modal
    CallTransfer = "call_transfer",
}
