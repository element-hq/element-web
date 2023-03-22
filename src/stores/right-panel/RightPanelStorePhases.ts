/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
            return _t("Threads");
        case RightPanelPhases.Timeline:
            return _t("Back to chat");
        case RightPanelPhases.RoomSummary:
            return _t("Room information");
        case RightPanelPhases.RoomMemberList:
            return _t("Room members");
        case RightPanelPhases.ThreadView:
            return _t("Back to thread");
    }
    return null;
}
