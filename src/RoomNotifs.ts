/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2019 , 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import {
    NotificationCountType,
    ConditionKind,
    PushRuleActionName,
    PushRuleKind,
    TweakName,
} from "matrix-js-sdk/src/matrix";

import type { IPushRule, Room, MatrixClient } from "matrix-js-sdk/src/matrix";
import { NotificationLevel } from "./stores/notifications/NotificationLevel";
import { getUnsentMessages } from "./components/structures/RoomStatusBar";
import { doesRoomHaveUnreadMessages, doesRoomOrThreadHaveUnreadMessages } from "./Unread";
import { EffectiveMembership, getEffectiveMembership, isKnockDenied } from "./utils/membership";
import SettingsStore from "./settings/SettingsStore";
import { getMarkedUnreadState } from "./utils/notifications";

export enum RoomNotifState {
    AllMessagesLoud = "all_messages_loud",
    AllMessages = "all_messages",
    MentionsOnly = "mentions_only",
    Mute = "mute",
}

export function getRoomNotifsState(client: MatrixClient, roomId: string): RoomNotifState | null {
    if (client.isGuest()) return RoomNotifState.AllMessages;

    // look through the override rules for a rule affecting this room:
    // if one exists, it will take precedence.
    const muteRule = findOverrideMuteRule(client, roomId);
    if (muteRule) {
        return RoomNotifState.Mute;
    }

    // for everything else, look at the room rule.
    let roomRule: IPushRule | undefined;
    try {
        roomRule = client.getRoomPushRule("global", roomId);
    } catch {
        // Possible that the client doesn't have pushRules yet. If so, it
        // hasn't started either, so indicate that this room is not notifying.
        return null;
    }

    // XXX: We have to assume the default is to notify for all messages
    // (in particular this will be 'wrong' for one to one rooms because
    // they will notify loudly for all messages)
    if (!roomRule?.enabled) return RoomNotifState.AllMessages;

    // a mute at the room level will still allow mentions
    // to notify
    if (isMuteRule(roomRule)) return RoomNotifState.MentionsOnly;

    const actionsObject = PushProcessor.actionListToActionsObject(roomRule.actions);
    if (actionsObject.tweaks.sound) return RoomNotifState.AllMessagesLoud;

    return null;
}

export function setRoomNotifsState(client: MatrixClient, roomId: string, newState: RoomNotifState): Promise<void> {
    if (newState === RoomNotifState.Mute) {
        return setRoomNotifsStateMuted(client, roomId);
    } else {
        return setRoomNotifsStateUnmuted(client, roomId, newState);
    }
}

export function getUnreadNotificationCount(
    room: Room,
    type: NotificationCountType,
    includeThreads: boolean,
    threadId?: string,
): number {
    const getCountShownForRoom = (r: Room, type: NotificationCountType): number => {
        return includeThreads ? r.getUnreadNotificationCount(type) : r.getRoomUnreadNotificationCount(type);
    };

    let notificationCount = !!threadId
        ? room.getThreadUnreadNotificationCount(threadId, type)
        : getCountShownForRoom(room, type);

    // Check notification counts in the old room just in case there's some lost
    // there. We only go one level down to avoid performance issues, and theory
    // is that 1st generation rooms will have already been read by the 3rd generation.
    const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
    const predecessor = room.findPredecessor(msc3946ProcessDynamicPredecessor);
    // Exclude threadId, as the same thread can't continue over a room upgrade
    if (!threadId && predecessor?.roomId) {
        const oldRoomId = predecessor.roomId;
        const oldRoom = room.client.getRoom(oldRoomId);
        if (oldRoom) {
            // We only ever care if there's highlights in the old room. No point in
            // notifying the user for unread messages because they would have extreme
            // difficulty changing their notification preferences away from "All Messages"
            // and "Noisy".
            notificationCount += getCountShownForRoom(oldRoom, NotificationCountType.Highlight);
        }
    }

    return notificationCount;
}

function setRoomNotifsStateMuted(cli: MatrixClient, roomId: string): Promise<any> {
    const promises: Promise<unknown>[] = [];

    // delete the room rule
    const roomRule = cli.getRoomPushRule("global", roomId);
    if (roomRule) {
        promises.push(cli.deletePushRule("global", PushRuleKind.RoomSpecific, roomRule.rule_id));
    }

    // add/replace an override rule to squelch everything in this room
    // NB. We use the room ID as the name of this rule too, although this
    // is an override rule, not a room rule: it still pertains to this room
    // though, so using the room ID as the rule ID is logical and prevents
    // duplicate copies of the rule.
    promises.push(
        cli.addPushRule("global", PushRuleKind.Override, roomId, {
            conditions: [
                {
                    kind: ConditionKind.EventMatch,
                    key: "room_id",
                    pattern: roomId,
                },
            ],
            actions: [PushRuleActionName.DontNotify],
        }),
    );

    return Promise.all(promises);
}

function setRoomNotifsStateUnmuted(cli: MatrixClient, roomId: string, newState: RoomNotifState): Promise<any> {
    const promises: Promise<unknown>[] = [];

    const overrideMuteRule = findOverrideMuteRule(cli, roomId);
    if (overrideMuteRule) {
        promises.push(cli.deletePushRule("global", PushRuleKind.Override, overrideMuteRule.rule_id));
    }

    if (newState === RoomNotifState.AllMessages) {
        const roomRule = cli.getRoomPushRule("global", roomId);
        if (roomRule) {
            promises.push(cli.deletePushRule("global", PushRuleKind.RoomSpecific, roomRule.rule_id));
        }
    } else if (newState === RoomNotifState.MentionsOnly) {
        promises.push(
            cli.addPushRule("global", PushRuleKind.RoomSpecific, roomId, {
                actions: [PushRuleActionName.DontNotify],
            }),
        );
    } else if (newState === RoomNotifState.AllMessagesLoud) {
        promises.push(
            cli.addPushRule("global", PushRuleKind.RoomSpecific, roomId, {
                actions: [
                    PushRuleActionName.Notify,
                    {
                        set_tweak: TweakName.Sound,
                        value: "default",
                    },
                ],
            }),
        );
    }

    return Promise.all(promises);
}

function findOverrideMuteRule(cli: MatrixClient | undefined, roomId: string): IPushRule | null {
    if (!cli?.pushRules?.global?.override) {
        return null;
    }
    for (const rule of cli.pushRules.global.override) {
        if (rule.enabled && isRuleRoomMuteRuleForRoomId(roomId, rule)) {
            return rule;
        }
    }
    return null;
}

/**
 * Checks if a given rule is a room mute rule as implemented by EW
 * - matches every event in one room (one condition that is an event match on roomId)
 * - silences notifications (one action that is `DontNotify`)
 * @param rule - push rule
 * @returns {boolean} - true when rule mutes a room
 */
export function isRuleMaybeRoomMuteRule(rule: IPushRule): boolean {
    return (
        // matches every event in one room
        rule.conditions?.length === 1 &&
        rule.conditions[0].kind === ConditionKind.EventMatch &&
        rule.conditions[0].key === "room_id" &&
        // silences notifications
        isMuteRule(rule)
    );
}

/**
 * Checks if a given rule is a room mute rule as implemented by EW
 * @param roomId - id of room to match
 * @param rule - push rule
 * @returns {boolean} true when rule mutes the given room
 */
function isRuleRoomMuteRuleForRoomId(roomId: string, rule: IPushRule): boolean {
    if (!isRuleMaybeRoomMuteRule(rule)) {
        return false;
    }
    // isRuleMaybeRoomMuteRule checks this condition exists
    const cond = rule.conditions![0]!;
    return cond.pattern === roomId;
}

function isMuteRule(rule: IPushRule): boolean {
    // DontNotify is equivalent to the empty actions array
    return (
        rule.actions.length === 0 || (rule.actions.length === 1 && rule.actions[0] === PushRuleActionName.DontNotify)
    );
}

/**
 * Returns an object giving information about the unread state of a room or thread
 * @param room The room to query, or the room the thread is in
 * @param threadId The thread to check the unread state of, or undefined to query the main thread
 * @param includeThreads If threadId is undefined, true to include threads other than the main thread, or
 *   false to exclude them. Ignored if threadId is specified.
 * @returns
 */
export function determineUnreadState(
    room?: Room,
    threadId?: string,
    includeThreads?: boolean,
): { level: NotificationLevel; symbol: string | null; count: number } {
    if (!room) {
        return { symbol: null, count: 0, level: NotificationLevel.None };
    }

    if (getUnsentMessages(room, threadId).length > 0) {
        return { symbol: "!", count: 1, level: NotificationLevel.Unsent };
    }

    if (getEffectiveMembership(room.getMyMembership()) === EffectiveMembership.Invite) {
        return { symbol: "!", count: 1, level: NotificationLevel.Highlight };
    }

    if (SettingsStore.getValue("feature_ask_to_join") && isKnockDenied(room)) {
        return { symbol: "!", count: 1, level: NotificationLevel.Highlight };
    }

    if (getRoomNotifsState(room.client, room.roomId) === RoomNotifState.Mute) {
        return { symbol: null, count: 0, level: NotificationLevel.None };
    }

    const redNotifs = getUnreadNotificationCount(
        room,
        NotificationCountType.Highlight,
        includeThreads ?? false,
        threadId,
    );
    const greyNotifs = getUnreadNotificationCount(room, NotificationCountType.Total, includeThreads ?? false, threadId);

    const trueCount = greyNotifs || redNotifs;
    if (redNotifs > 0) {
        return { symbol: null, count: trueCount, level: NotificationLevel.Highlight };
    }

    const markedUnreadState = getMarkedUnreadState(room);
    if (greyNotifs > 0 || markedUnreadState) {
        return { symbol: null, count: trueCount, level: NotificationLevel.Notification };
    }

    // We don't have any notified messages, but we might have unread messages. Let's find out.
    let hasUnread = false;
    if (threadId) {
        const thread = room.getThread(threadId);
        if (thread) {
            hasUnread = doesRoomOrThreadHaveUnreadMessages(thread);
        }
        // If the thread does not exist, assume it contains no unreads
    } else {
        hasUnread = doesRoomHaveUnreadMessages(room, includeThreads ?? false);
    }

    return {
        symbol: null,
        count: trueCount,
        level: hasUnread ? NotificationLevel.Activity : NotificationLevel.None,
    };
}
