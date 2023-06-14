/*
Copyright 2016 - 2022 The Matrix.org Foundation C.I.C.

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

import { IAnnotatedPushRule, PushRuleAction, RuleId } from "matrix-js-sdk/src/@types/PushRules";
import { logger } from "matrix-js-sdk/src/logger";

import { _td } from "../languageHandler";
import { StandardActions } from "./StandardActions";
import { PushRuleVectorState, VectorState } from "./PushRuleVectorState";
import { NotificationUtils } from "./NotificationUtils";

type StateToActionsMap = {
    [state in VectorState]?: PushRuleAction[];
};

interface IVectorPushRuleDefinition {
    description: string;
    vectorStateToActions: StateToActionsMap;
    /**
     * Rules that should be updated to be kept in sync
     * when this rule changes
     */
    syncedRuleIds?: (RuleId | string)[];
}

class VectorPushRuleDefinition {
    public readonly description: string;
    public readonly vectorStateToActions: StateToActionsMap;
    public readonly syncedRuleIds?: (RuleId | string)[];

    public constructor(opts: IVectorPushRuleDefinition) {
        this.description = opts.description;
        this.vectorStateToActions = opts.vectorStateToActions;
        this.syncedRuleIds = opts.syncedRuleIds;
    }

    // Translate the rule actions and its enabled value into vector state
    public ruleToVectorState(rule: IAnnotatedPushRule): VectorState | undefined {
        let enabled = false;
        if (rule) {
            enabled = rule.enabled;
        }

        for (const state of Object.values(PushRuleVectorState.states)) {
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
                if (
                    enabled &&
                    JSON.stringify(NotificationUtils.decodeActions(rule.actions)) ===
                        JSON.stringify(NotificationUtils.decodeActions(vectorStateToActions))
                ) {
                    return state;
                }
            }
        }

        logger.error(
            `Cannot translate rule actions into Vector rule state. ` +
                `Rule: ${JSON.stringify(rule)}, ` +
                `Expected: ${JSON.stringify(this.vectorStateToActions)}`,
        );
        return undefined;
    }
}
export type { VectorPushRuleDefinition };

/**
 * The descriptions of rules managed by the Vector UI.
 */
export const VectorPushRulesDefinitions: Record<string, VectorPushRuleDefinition> = {
    // Messages containing user's display name
    ".m.rule.contains_display_name": new VectorPushRuleDefinition({
        description: _td("Messages containing my display name"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // The actions for each vector state, or null to disable the rule.
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages containing user's username (localpart/MXID)
    ".m.rule.contains_user_name": new VectorPushRuleDefinition({
        description: _td("Messages containing my username"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // The actions for each vector state, or null to disable the rule.
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages containing @room
    ".m.rule.roomnotif": new VectorPushRuleDefinition({
        description: _td("Messages containing @room"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // The actions for each vector state, or null to disable the rule.
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_HIGHLIGHT,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),

    // Messages just sent to the user in a 1:1 room
    ".m.rule.room_one_to_one": new VectorPushRuleDefinition({
        description: _td("Messages in one-to-one chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DONT_NOTIFY,
        },
        syncedRuleIds: [
            RuleId.PollStartOneToOne,
            RuleId.PollStartOneToOneUnstable,
            RuleId.PollEndOneToOne,
            RuleId.PollEndOneToOneUnstable,
        ],
    }),

    // Encrypted messages just sent to the user in a 1:1 room
    ".m.rule.encrypted_room_one_to_one": new VectorPushRuleDefinition({
        description: _td("Encrypted messages in one-to-one chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Messages just sent to a group chat room
    // 1:1 room messages are caught by the .m.rule.room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.message": new VectorPushRuleDefinition({
        description: _td("Messages in group chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DONT_NOTIFY,
        },
        syncedRuleIds: [RuleId.PollStart, RuleId.PollStartUnstable, RuleId.PollEnd, RuleId.PollEndUnstable],
    }),

    // Encrypted messages just sent to a group chat room
    // Encrypted 1:1 room messages are caught by the .m.rule.encrypted_room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.encrypted": new VectorPushRuleDefinition({
        description: _td("Encrypted messages in group chats"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Invitation for the user
    ".m.rule.invite_for_me": new VectorPushRuleDefinition({
        description: _td("When I'm invited to a room"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),

    // Incoming call
    ".m.rule.call": new VectorPushRuleDefinition({
        description: _td("Call invitation"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_RING_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),

    // Notifications from bots
    ".m.rule.suppress_notices": new VectorPushRuleDefinition({
        description: _td("Messages sent by bot"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
            [VectorState.On]: StandardActions.ACTION_DISABLED,
            [VectorState.Loud]: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            [VectorState.Off]: StandardActions.ACTION_DONT_NOTIFY,
        },
    }),

    // Room upgrades (tombstones)
    ".m.rule.tombstone": new VectorPushRuleDefinition({
        description: _td("When rooms are upgraded"), // passed through _t() translation in src/components/views/settings/Notifications.js
        vectorStateToActions: {
            // The actions for each vector state, or null to disable the rule.
            [VectorState.On]: StandardActions.ACTION_NOTIFY,
            [VectorState.Loud]: StandardActions.ACTION_HIGHLIGHT,
            [VectorState.Off]: StandardActions.ACTION_DISABLED,
        },
    }),
};
