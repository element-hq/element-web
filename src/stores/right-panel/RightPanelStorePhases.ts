/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../../languageHandler";

// These are in their own file because of circular imports being a problem.
export enum RightPanelPhases {
    // Room stuff
    RoomMemberList = "RoomMemberList",
    FilePanel = "FilePanel",
    NotificationPanel = "NotificationPanel",
    RoomMemberInfo = "RoomMemberInfo",
    EncryptionPanel = "EncryptionPanel",
    RoomSummary = "RoomSummary",
    Widget = "Widget",
    PinnedMessages = "PinnedMessages",
    Timeline = "Timeline",
    Extensions = "Extensions",

    Room3pidMemberInfo = "Room3pidMemberInfo",

    // Space stuff
    SpaceMemberList = "SpaceMemberList",
    SpaceMemberInfo = "SpaceMemberInfo",
    Space3pidMemberInfo = "Space3pidMemberInfo",

    // Thread stuff
    ThreadView = "ThreadView",
    ThreadPanel = "ThreadPanel",
}

export function backLabelForPhase(phase: RightPanelPhases | null): string | null {
    switch (phase) {
        case RightPanelPhases.ThreadPanel:
            return _t("common|threads");
        case RightPanelPhases.Timeline:
            return _t("chat_card_back_action_label");
        case RightPanelPhases.RoomSummary:
            return _t("room_summary_card_back_action_label");
        case RightPanelPhases.RoomMemberList:
            return _t("member_list_back_action_label");
        case RightPanelPhases.ThreadView:
            return _t("thread_view_back_action_label");
    }
    return null;
}
