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

'use strict';

import { _td } from '../languageHandler';
import {StandardActions} from "./StandardActions";
import {PushRuleVectorState} from "./PushRuleVectorState";
import {NotificationUtils} from "./NotificationUtils";

class VectorPushRuleDefinition {
    constructor(opts) {
        this.kind = opts.kind;
        this.description = opts.description;
        this.vectorStateToActions = opts.vectorStateToActions;
    }

    // Translate the rule actions and its enabled value into vector state
    ruleToVectorState(rule) {
        let enabled = false;
        if (rule) {
            enabled = rule.enabled;
        }

        for (const stateKey in PushRuleVectorState.states) { // eslint-disable-line guard-for-in
            const state = PushRuleVectorState.states[stateKey];
            const vectorStateToActions = this.vectorStateToActions[state];

            if (!vectorStateToActions) {
                // No defined actions means that this vector state expects a disabled (or absent) rule
                if (!enabled) {
                    return state;
                }
            } else {
                // The actions must match to the ones expected by vector state.
                // Use `decodeActions` on both sides to canonicalize things like
                // value: true vs. unspecified for highlight (which defaults to
                // true, making them equivalent).
                if (enabled &&
                        JSON.stringify(NotificationUtils.decodeActions(rule.actions)) ===
                        JSON.stringify(NotificationUtils.decodeActions(vectorStateToActions))) {
                    return state;
                }
            }
        }

        console.error(`Cannot translate rule actions into Vector rule state. ` +
            `Rule: ${JSON.stringify(rule)}, ` +
            `Expected: ${JSON.stringify(this.vectorStateToActions)}`);
        return undefined;
    }
}

/**
 * The descriptions of rules managed by the Vector UI.
 */
export const VectorPushRulesDefinitions = {
    // Messages containing user's display name
    ".m.rule.contains_display_name": new VectorPushRuleDefinition({
        kind: "override",
        description: _td("Messages containing my display name"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            off: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages containing user's username (localpart/MXID)
    ".m.rule.contains_user_name": new VectorPushRuleDefinition({
        kind: "override",
        description: _td("Messages containing my username"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            off: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages containing @room
    ".m.rule.roomnotif": new VectorPushRuleDefinition({
        kind: "override",
        description: _td("Messages containing @room"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_HIGHLIGHT,
            off: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages just sent to the user in a 1:1 room
    ".m.rule.room_one_to_one": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("Messages in one-to-one chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Encrypted messages just sent to the user in a 1:1 room
    ".m.rule.encrypted_room_one_to_one": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("Encrypted messages in one-to-one chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Messages just sent to a group chat room
    // 1:1 room messages are catched by the .m.rule.room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.message": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("Messages in group chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Encrypted messages just sent to a group chat room
    // Encrypted 1:1 room messages are catched by the .m.rule.encrypted_room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.encrypted": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("Encrypted messages in group chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Invitation for the user
    ".m.rule.invite_for_me": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("When I'm invited to a room"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DISABLED,
        },
    }),

    // Incoming call
    ".m.rule.call": new VectorPushRuleDefinition({
        kind: "underride",
        description: _td("Call invitation"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_RING_SOUND,
            off: StandardActions.ACTION_DISABLED,
        },
    }),

    // Notifications from bots
    ".m.rule.suppress_notices": new VectorPushRuleDefinition({
        kind: "override",
        description: _td("Messages sent by bot"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
            on: StandardActions.ACTION_DISABLED,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Room upgrades (tombstones)
    ".m.rule.tombstone": new VectorPushRuleDefinition({
        kind: "override",
        description: _td("When rooms are upgraded"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_HIGHLIGHT,
            off: StandardActions.ACTION_DISABLED,
        },
    }),
};
