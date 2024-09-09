/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

export enum PerformanceEntryNames {
    /**
     * Application wide
     */

    APP_STARTUP = "mx_AppStartup",
    PAGE_CHANGE = "mx_PageChange",

    /**
     * Events
     */

    RESEND_EVENT = "mx_ResendEvent",
    SEND_E2EE_EVENT = "mx_SendE2EEEvent",
    SEND_ATTACHMENT = "mx_SendAttachment",

    /**
     * Rooms
     */

    SWITCH_ROOM = "mx_SwithRoom",
    JUMP_TO_ROOM = "mx_JumpToRoom",
    JOIN_ROOM = "mx_JoinRoom", // ✅
    CREATE_DM = "mx_CreateDM", // ✅
    PEEK_ROOM = "mx_PeekRoom",

    /**
     * User
     */

    VERIFY_E2EE_USER = "mx_VerifyE2EEUser", // ✅
    LOGIN = "mx_Login", // ✅
    REGISTER = "mx_Register", // ✅

    /**
     * VoIP
     */

    SETUP_VOIP_CALL = "mx_SetupVoIPCall",
}
