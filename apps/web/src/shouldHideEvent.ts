/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, EventType, RelationType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import SettingsStore from "./settings/SettingsStore";
import { type IRoomState } from "./components/structures/RoomView";
import { type SettingKey } from "./settings/Settings.tsx";

interface IDiff {
    isMemberEvent: boolean;
    isJoin?: boolean;
    isPart?: boolean;
    isDisplaynameChange?: boolean;
    isAvatarChange?: boolean;
}

function memberEventDiff(ev: MatrixEvent): IDiff {
    const diff: IDiff = {
        isMemberEvent: ev.getType() === EventType.RoomMember,
    };

    // If is not a Member Event then the other checks do not apply, so bail early.
    if (!diff.isMemberEvent) return diff;

    const content = ev.getContent();
    const prevContent = ev.getPrevContent();

    const isMembershipChanged = content.membership !== prevContent.membership;
    diff.isJoin = isMembershipChanged && content.membership === KnownMembership.Join;
    diff.isPart =
        isMembershipChanged && content.membership === KnownMembership.Leave && ev.getStateKey() === ev.getSender();

    const isJoinToJoin = !isMembershipChanged && content.membership === KnownMembership.Join;
    diff.isDisplaynameChange = isJoinToJoin && content.displayname !== prevContent.displayname;
    diff.isAvatarChange = isJoinToJoin && content.avatar_url !== prevContent.avatar_url;
    return diff;
}

/**
 * Determines whether the given event should be hidden from timelines.
 * @param ev The event
 * @param ctx An optional RoomContext to pull cached settings values from to avoid
 *     hitting the settings store
 */
export default function shouldHideEvent(ev: MatrixEvent, ctx?: IRoomState): boolean {
    // Accessing the settings store directly can be expensive if done frequently,
    // so we should prefer using cached values if a RoomContext is available
    const isEnabled = ctx
        ? (name: keyof IRoomState) => ctx[name]
        : (name: SettingKey) => SettingsStore.getValue(name, ev.getRoomId());

    // Hide redacted events
    // Deleted events with a thread are always shown regardless of user preference
    // to make sure that a thread can be accessible even if the root message is deleted
    if (ev.isRedacted() && !isEnabled("showRedactions") && !ev.getThread()) return true;

    // Hide replacement events since they update the original tile (if enabled)
    if (ev.isRelation(RelationType.Replace)) return true;

    const eventDiff = memberEventDiff(ev);

    if (eventDiff.isMemberEvent) {
        if ((eventDiff.isJoin || eventDiff.isPart) && !isEnabled("showJoinLeaves")) return true;
        if (eventDiff.isAvatarChange && !isEnabled("showAvatarChanges")) return true;
        if (eventDiff.isDisplaynameChange && !isEnabled("showDisplaynameChanges")) return true;
    }

    return false;
}
