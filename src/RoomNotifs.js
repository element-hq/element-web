/*
Copyright 2016 OpenMarket Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import PushProcessor from 'matrix-js-sdk/lib/pushprocessor';
import q from 'q';

export const ALL_MESSAGES_LOUD = 'all_messages_loud';
export const ALL_MESSAGES = 'all_messages';
export const MENTIONS_ONLY = 'mentions_only';
export const MUTE = 'mute';

export function getRoomNotifsState(roomId) {
    if (MatrixClientPeg.get().isGuest()) return ALL_MESSAGES;

    // look through the override rules for a rule affecting this room:
    // if one exists, it will take precedence.
    const muteRule = findOverrideMuteRule(roomId);
    if (muteRule) {
        return MUTE;
    }

    // for everything else, look at the room rule.
    const roomRule = MatrixClientPeg.get().getRoomPushRule('global', roomId);

    // XXX: We have to assume the default is to notify for all messages
    // (in particular this will be 'wrong' for one to one rooms because
    // they will notify loudly for all messages)
    if (!roomRule || !roomRule.enabled) return ALL_MESSAGES;

    // a mute at the room level will still allow mentions
    // to notify
    if (isMuteRule(roomRule)) return MENTIONS_ONLY;

    const actionsObject = PushProcessor.actionListToActionsObject(roomRule.actions);
    if (actionsObject.tweaks.sound) return ALL_MESSAGES_LOUD;

    return null;
}

export function setRoomNotifsState(roomId, newState) {
    if (newState == MUTE) {
        return setRoomNotifsStateMuted(roomId);
    } else {
        return setRoomNotifsStateUnmuted(roomId, newState);
    }
}

function setRoomNotifsStateMuted(roomId) {
    const cli = MatrixClientPeg.get();
    const promises = [];

    // delete the room rule
    const roomRule = cli.getRoomPushRule('global', roomId);
    if (roomRule) {
        promises.push(cli.deletePushRule('global', 'room', roomRule.rule_id));
    }

    // add/replace an override rule to squelch everything in this room
    // NB. We use the room ID as the name of this rule too, although this
    // is an override rule, not a room rule: it still pertains to this room
    // though, so using the room ID as the rule ID is logical and prevents
    // duplicate copies of the rule.
    promises.push(cli.addPushRule('global', 'override', roomId, {
        conditions: [
            {
                kind: 'event_match',
                key: 'room_id',
                pattern: roomId,
            }
        ],
        actions: [
            'dont_notify',
        ]
    }));

    return q.all(promises);
}

function setRoomNotifsStateUnmuted(roomId, newState) {
    const cli = MatrixClientPeg.get();
    const promises = [];

    const overrideMuteRule = findOverrideMuteRule(roomId);
    if (overrideMuteRule) {
        promises.push(cli.deletePushRule('global', 'override', overrideMuteRule.rule_id));
    }

    if (newState == 'all_messages') {
        const roomRule = cli.getRoomPushRule('global', roomId);
        if (roomRule) {
            promises.push(cli.deletePushRule('global', 'room', roomRule.rule_id));
        }
    } else if (newState == 'mentions_only') {
        promises.push(cli.addPushRule('global', 'room', roomId, {
            actions: [
                'dont_notify',
            ]
        }));
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled('global', 'room', roomId, true));
    } else if ('all_messages_loud') {
        promises.push(cli.addPushRule('global', 'room', roomId, {
            actions: [
                'notify',
                {
                    set_tweak: 'sound',
                    value: 'default',
                }
            ]
        }));
        // https://matrix.org/jira/browse/SPEC-400
        promises.push(cli.setPushRuleEnabled('global', 'room', roomId, true));
    }

    return q.all(promises);
}

function findOverrideMuteRule(roomId) {
    for (const rule of MatrixClientPeg.get().pushRules['global'].override) {
        if (isRuleForRoom(roomId, rule)) {
            if (isMuteRule(rule) && rule.enabled) {
                return rule;
            }
        }
    }
    return null;
}

function isRuleForRoom(roomId, rule) {
    if (rule.conditions.length !== 1) {
        return false;
    }
    const cond = rule.conditions[0];
    if (
        cond.kind == 'event_match'  &&
        cond.key == 'room_id' &&
        cond.pattern == roomId
    ) {
        return true;
    }
    return false;
}

function isMuteRule(rule) {
    return (
        rule.actions.length == 1 &&
        rule.actions[0] == 'dont_notify'
    );
}

