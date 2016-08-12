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

import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import PushProcessor from 'matrix-js-sdk/lib/pushprocessor';

export function getVectorRoomNotifsState(roomId) {
    // look through the override rules for a rule affecting this room:
    // if one exists, it will take precedence.
    for (const rule of MatrixClientPeg.get().pushRules['global'].override) {
        if (isRuleForRoom(roomId, rule)) {
            if (isMuteRule(rule)) {
                return 'mute';
            }
        }
    }

    // for everything else, look at the room rule.
    const roomRule = MatrixClientPeg.get().getRoomPushRule('global', roomId);

    // XXX: We have to assume the default is to notify for all messages
    // (in particular this will be 'wrong' for one to one rooms because
    // they will notify loudly for all messages)
    if (!roomRule) return 'all_messages';

    // a mute at the room level will still allow mentions
    // to notify
    if (isMuteRule(roomRule)) return 'mentions_only';

    const actionsObject = PushProcessor.actionListToActionsObject(roomRule.actions);
    if (actionsObject.tweaks.sound) return 'all_messages_loud';

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

