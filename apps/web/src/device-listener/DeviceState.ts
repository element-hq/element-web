/*
Copyright 2025-2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The state of the device and the user's account.
 */
export type DeviceState =
    /**
     * The device is in a good state.
     */
    | "ok"
    /**
     * The user needs to set up recovery.
     */
    | "set_up_recovery"
    /**
     * The device is not verified.
     */
    | "verify_this_session"
    /**
     * Key storage is out of sync (keys are missing locally, from recovery, or both).
     */
    | "key_storage_out_of_sync"
    /**
     * Key storage is not enabled, and has not been marked as purposely disabled.
     */
    | "turn_on_key_storage"
    /**
     * The user's identity needs resetting, due to missing keys.
     */
    | "identity_needs_reset";
