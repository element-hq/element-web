/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
