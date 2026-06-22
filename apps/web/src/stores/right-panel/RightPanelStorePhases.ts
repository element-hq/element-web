/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// These are in their own file because of circular imports being a problem.
export enum RightPanelPhases {
    // Room & Space stuff
    MemberList = "MemberList",
    MemberInfo = "MemberInfo",
    ThreePidMemberInfo = "ThreePidMemberInfo",

    // Room stuff
    FilePanel = "FilePanel",
    NotificationPanel = "NotificationPanel",
    EncryptionPanel = "EncryptionPanel",
    RoomSummary = "RoomSummary",
    Widget = "Widget",
    PinnedMessages = "PinnedMessages",
    Timeline = "Timeline",
    Extensions = "Extensions",

    // Thread stuff
    ThreadView = "ThreadView",
    ThreadPanel = "ThreadPanel",
}
