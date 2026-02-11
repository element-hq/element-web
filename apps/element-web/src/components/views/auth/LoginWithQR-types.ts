/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The intention of this enum is to have a mode that scans a QR code instead of generating one.
 */
export enum Mode {
    /**
     * A QR code with be generated and shown
     */
    Show = "show",
}

export enum Phase {
    Loading,
    ShowingQR,
    // The following are specific to MSC4108
    OutOfBandConfirmation,
    WaitingForDevice,
    Verifying,
    Error,
}

export enum Click {
    Cancel,
    Decline,
    Approve,
    Back,
    ShowQr,
}
