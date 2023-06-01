/*
Copyright 2016, 2019, 2023 The Matrix.org Foundation C.I.C.

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

import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { NotificationCountType } from "matrix-js-sdk/src/models/room";
import { ConditionKind, PushRuleActionName, PushRuleKind, TweakName } from "matrix-js-sdk/src/@types/PushRules";

import type { IPushRule } from "matrix-js-sdk/src/@types/PushRules";
import type { Room } from "matrix-js-sdk/src/models/room";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { NotificationColor } from "./stores/notifications/NotificationColor";
import { getUnsentMessages } from "./components/structures/RoomStatusBar";
import { doesRoomHaveUnreadMessages, doesRoomOrThreadHaveUnreadMessages } from "./Unread";
import { EffectiveMembership, getEffectiveMembership } from "./utils/membership";
import SettingsStore from "./settings/SettingsStore";

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
    } catch (err) {
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

export function getUnreadNotificationCount(room: Room, type: NotificationCountType, threadId?: string): number {
    let notificationCount = !!threadId
        ? room.getThreadUnreadNotificationCount(threadId, type)
        : room.getUnreadNotificationCount(type);

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
            notificationCount += oldRoom.getUnreadNotificationCount(NotificationCountType.Highlight);
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
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled("global", PushRuleKind.RoomSpecific, roomId, true));
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
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled("global", PushRuleKind.RoomSpecific, roomId, true));
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
    return rule.actions.length === 1 && rule.actions[0] === PushRuleActionName.DontNotify;
}

export function determineUnreadState(
    room?: Room,
    threadId?: string,
): { color: NotificationColor; symbol: string | null; count: number } {
    if (!room) {
        return { symbol: null, count: 0, color: NotificationColor.None };
    }

    if (getUnsentMessages(room, threadId).length > 0) {
        return { symbol: "!", count: 1, color: NotificationColor.Unsent };
    }

    if (getEffectiveMembership(room.getMyMembership()) === EffectiveMembership.Invite) {
        return { symbol: "!", count: 1, color: NotificationColor.Red };
    }

    if (getRoomNotifsState(room.client, room.roomId) === RoomNotifState.Mute) {
        return { symbol: null, count: 0, color: NotificationColor.None };
    }

    const redNotifs = getUnreadNotificationCount(room, NotificationCountType.Highlight, threadId);
    const greyNotifs = getUnreadNotificationCount(room, NotificationCountType.Total, threadId);

    const trueCount = greyNotifs || redNotifs;
    if (redNotifs > 0) {
        return { symbol: null, count: trueCount, color: NotificationColor.Red };
    }

    if (greyNotifs > 0) {
        return { symbol: null, count: trueCount, color: NotificationColor.Grey };
    }

    // We don't have any notified messages, but we might have unread messages. Let's
    // find out.
    let hasUnread = false;
    if (threadId) hasUnread = doesRoomOrThreadHaveUnreadMessages(room.getThread(threadId)!);
    else hasUnread = doesRoomHaveUnreadMessages(room);

    return {
        symbol: null,
        count: trueCount,
        color: hasUnread ? NotificationColor.Bold : NotificationColor.None,
    };
}
