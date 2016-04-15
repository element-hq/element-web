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

'use strict';

var StandardActions = require('./StandardActions');
var PushRuleVectorState = require('./PushRuleVectorState');

class VectorPushRuleDefinition {
    constructor(opts) {
        this.kind = opts.kind;
        this.description = opts.description;
        this.vectorStateToActions = opts.vectorStateToActions;
    }

    // Translate the rule actions and its enabled value into vector state
    ruleToVectorState(rule) {
        var enabled = false;
        var actions = null;
        if (rule) {
            enabled = rule.enabled;
            actions = rule.actions;
        }

        for (var stateKey in PushRuleVectorState.states) {
            var state = PushRuleVectorState.states[stateKey];
            var vectorStateToActions = this.vectorStateToActions[state];

            if (!vectorStateToActions) {
                // No defined actions means that this vector state expects a disabled (or absent) rule
                if (!enabled) {
                    return state;
                }
            } else {
                // The actions must match to the ones expected by vector state
                if (enabled && JSON.stringify(rule.actions) === JSON.stringify(vectorStateToActions)) {
                    return state;
                }
            }
        }

        console.error("Cannot translate rule actions into Vector rule state. Rule: " +
                      JSON.stringify(rule));
        return undefined;
    }
};

/**
 * The descriptions of rules managed by the Vector UI.
 */
module.exports = {
    // Messages containing user's display name
    // (skip contains_user_name which is too geeky)
    ".m.rule.contains_display_name": new VectorPushRuleDefinition({
        kind: "underride",
        description: "Messages containing my name",
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            off: StandardActions.ACTION_DISABLED
        }
    }),

    // Messages just sent to the user in a 1:1 room
    ".m.rule.room_one_to_one": new VectorPushRuleDefinition({
        kind: "underride",
        description: "Messages in one-to-one chats",
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY
        }
    }),

    // Messages just sent to a group chat room
    // 1:1 room messages are catched by the .m.rule.room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.message": new VectorPushRuleDefinition({
        kind: "underride",
        description: "Messages in group chats",
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY
        }
    }),

    // Invitation for the user
    ".m.rule.invite_for_me": new VectorPushRuleDefinition({
        kind: "underride",
        description: "When I'm invited to a room",
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DISABLED
        }
    }),

    // Incoming call
    ".m.rule.call": new VectorPushRuleDefinition({
        kind: "underride",
        description: "Call invitation",
        vectorStateToActions: {
            on: StandardActions.ACTION_NOTIFY,
            loud: StandardActions.ACTION_NOTIFY_RING_SOUND,
            off: StandardActions.ACTION_DISABLED
        }
    }),

    // Notifications from bots
    ".m.rule.suppress_notices": new VectorPushRuleDefinition({
        kind: "override",
        description: "Messages sent by bot",
        vectorStateToActions: {
            // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
            on: StandardActions.ACTION_DISABLED,
            loud: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            off: StandardActions.ACTION_DONT_NOTIFY,
        }
    }),
};
