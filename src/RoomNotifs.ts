/*
Copyright 2016 OpenMarket Ltd
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

import { PushProcessor } from 'matrix-js-sdk/src/pushprocessor';
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import { ConditionKind, IPushRule, PushRuleActionName, PushRuleKind } from "matrix-js-sdk/src/@types/PushRules";

import { MatrixClientPeg } from './MatrixClientPeg';

export enum RoomNotifState {
    AllMessagesLoud = 'all_messages_loud',
    AllMessages = 'all_messages',
    MentionsOnly = 'mentions_only',
    Mute = 'mute',
}

export const BADGE_STATES = [RoomNotifState.AllMessages, RoomNotifState.AllMessagesLoud];
export const MENTION_BADGE_STATES = [...BADGE_STATES, RoomNotifState.MentionsOnly];

export function shouldShowNotifBadge(roomNotifState: RoomNotifState): boolean {
    return BADGE_STATES.includes(roomNotifState);
}

export function shouldShowMentionBadge(roomNotifState: RoomNotifState): boolean {
    return MENTION_BADGE_STATES.includes(roomNotifState);
}

export function aggregateNotificationCount(rooms: Room[]): {count: number, highlight: boolean} {
    return rooms.reduce<{count: number, highlight: boolean}>((result, room) => {
        const roomNotifState = getRoomNotifsState(room.roomId);
        const highlight = room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0;
        // use helper method to include highlights in the previous version of the room
        const notificationCount = getUnreadNotificationCount(room);

        const notifBadges = notificationCount > 0 && shouldShowNotifBadge(roomNotifState);
        const mentionBadges = highlight && shouldShowMentionBadge(roomNotifState);
        const badges = notifBadges || mentionBadges;

        if (badges) {
            result.count += notificationCount;
            if (highlight) {
                result.highlight = true;
            }
        }
        return result;
    }, { count: 0, highlight: false });
}

export function getRoomHasBadge(room: Room): boolean {
    const roomNotifState = getRoomNotifsState(room.roomId);
    const highlight = room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0;
    const notificationCount = room.getUnreadNotificationCount();

    const notifBadges = notificationCount > 0 && shouldShowNotifBadge(roomNotifState);
    const mentionBadges = highlight && shouldShowMentionBadge(roomNotifState);

    return notifBadges || mentionBadges;
}

export function getRoomNotifsState(roomId: string): RoomNotifState {
    if (MatrixClientPeg.get().isGuest()) return RoomNotifState.AllMessages;

    // look through the override rules for a rule affecting this room:
    // if one exists, it will take precedence.
    const muteRule = findOverrideMuteRule(roomId);
    if (muteRule) {
        return RoomNotifState.Mute;
    }

    // for everything else, look at the room rule.
    let roomRule = null;
    try {
        roomRule = MatrixClientPeg.get().getRoomPushRule('global', roomId);
    } catch (err) {
        // Possible that the client doesn't have pushRules yet. If so, it
        // hasn't started eiher, so indicate that this room is not notifying.
        return null;
    }

    // XXX: We have to assume the default is to notify for all messages
    // (in particular this will be 'wrong' for one to one rooms because
    // they will notify loudly for all messages)
    if (!roomRule || !roomRule.enabled) return RoomNotifState.AllMessages;

    // a mute at the room level will still allow mentions
    // to notify
    if (isMuteRule(roomRule)) return RoomNotifState.MentionsOnly;

    const actionsObject = PushProcessor.actionListToActionsObject(roomRule.actions);
    if (actionsObject.tweaks.sound) return RoomNotifState.AllMessagesLoud;

    return null;
}

export function setRoomNotifsState(roomId: string, newState: RoomNotifState): Promise<void> {
    if (newState === RoomNotifState.Mute) {
        return setRoomNotifsStateMuted(roomId);
    } else {
        return setRoomNotifsStateUnmuted(roomId, newState);
    }
}

export function getUnreadNotificationCount(room: Room, type: NotificationCountType = null): number {
    let notificationCount = room.getUnreadNotificationCount(type);

    // Check notification counts in the old room just in case there's some lost
    // there. We only go one level down to avoid performance issues, and theory
    // is that 1st generation rooms will have already been read by the 3rd generation.
    const createEvent = room.currentState.getStateEvents("m.room.create", "");
    if (createEvent && createEvent.getContent()['predecessor']) {
        const oldRoomId = createEvent.getContent()['predecessor']['room_id'];
        const oldRoom = MatrixClientPeg.get().getRoom(oldRoomId);
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

function setRoomNotifsStateMuted(roomId: string): Promise<any> {
    const cli = MatrixClientPeg.get();
    const promises = [];

    // delete the room rule
    const roomRule = cli.getRoomPushRule('global', roomId);
    if (roomRule) {
        promises.push(cli.deletePushRule('global', PushRuleKind.RoomSpecific, roomRule.rule_id));
    }

    // add/replace an override rule to squelch everything in this room
    // NB. We use the room ID as the name of this rule too, although this
    // is an override rule, not a room rule: it still pertains to this room
    // though, so using the room ID as the rule ID is logical and prevents
    // duplicate copies of the rule.
    promises.push(cli.addPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [
            {
                kind: 'event_match',
                key: 'room_id',
                pattern: roomId,
            },
        ],
        actions: [
            'dont_notify',
        ],
    }));

    return Promise.all(promises);
}

function setRoomNotifsStateUnmuted(roomId: string, newState: RoomNotifState): Promise<any> {
    const cli = MatrixClientPeg.get();
    const promises = [];

    const overrideMuteRule = findOverrideMuteRule(roomId);
    if (overrideMuteRule) {
        promises.push(cli.deletePushRule('global', PushRuleKind.Override, overrideMuteRule.rule_id));
    }

    if (newState === RoomNotifState.AllMessages) {
        const roomRule = cli.getRoomPushRule('global', roomId);
        if (roomRule) {
            promises.push(cli.deletePushRule('global', PushRuleKind.RoomSpecific, roomRule.rule_id));
        }
    } else if (newState === RoomNotifState.MentionsOnly) {
        promises.push(cli.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
            actions: [
                'dont_notify',
            ],
        }));
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled('global', PushRuleKind.RoomSpecific, roomId, true));
    } else if (newState === RoomNotifState.AllMessagesLoud) {
        promises.push(cli.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
            actions: [
                'notify',
                {
                    set_tweak: 'sound',
                    value: 'default',
                },
            ],
        }));
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled('global', PushRuleKind.RoomSpecific, roomId, true));
    }

    return Promise.all(promises);
}

function findOverrideMuteRule(roomId: string): IPushRule {
    const cli = MatrixClientPeg.get();
    if (!cli?.pushRules?.global?.override) {
        return null;
    }
    for (const rule of cli.pushRules.global.override) {
        if (isRuleForRoom(roomId, rule)) {
            if (isMuteRule(rule) && rule.enabled) {
                return rule;
            }
        }
    }
    return null;
}

function isRuleForRoom(roomId: string, rule: IPushRule): boolean {
    if (rule.conditions.length !== 1) {
        return false;
    }
    const cond = rule.conditions[0];
    return (cond.kind === ConditionKind.EventMatch && cond.key === 'room_id' && cond.pattern === roomId);
}

function isMuteRule(rule: IPushRule): boolean {
    return (rule.actions.length === 1 && rule.actions[0] === PushRuleActionName.DontNotify);
}
