/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { IAnnotatedPushRule, IPushRule, IPushRules, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";

/**
 * Default set of push rules for a new account
 * Use to mock push rule fetching, or use `getDefaultRuleWithKind`
 * to use default examples of specific push rules
 */
export const DEFAULT_PUSH_RULES: IPushRules = Object.freeze({
    global: {
        underride: [
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "m.call.invite" }],
                actions: ["notify", { set_tweak: "sound", value: "ring" }, { set_tweak: "highlight", value: false }],
                rule_id: ".m.rule.call",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "m.room.message" },
                    { kind: "room_member_count", is: "2" },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".m.rule.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "m.room.encrypted" },
                    { kind: "room_member_count", is: "2" },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".m.rule.encrypted_room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.encrypted" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.encrypted_room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.message" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.message.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.file" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.file.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.image" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.image.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.video" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.video.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc1767.audio" },
                    { kind: "room_member_count", is: "2" },
                    {
                        kind: "org.matrix.msc3931.room_version_supports",
                        feature: "org.matrix.msc3932.extensible_events",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }, { set_tweak: "highlight", value: false }],
                rule_id: ".org.matrix.msc3933.rule.extensible.audio.room_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "m.room.message" }],
                actions: ["notify", { set_tweak: "highlight", value: false }],
                rule_id: ".m.rule.message",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "m.room.encrypted" }],
                actions: ["notify", { set_tweak: "highlight", value: false }],
                rule_id: ".m.rule.encrypted",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "im.vector.modular.widgets" },
                    { kind: "event_match", key: "content.type", pattern: "jitsi" },
                    { kind: "event_match", key: "state_key", pattern: "*" },
                ],
                actions: ["notify", { set_tweak: "highlight", value: false }],
                rule_id: ".im.vector.jitsi",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "room_member_count", is: "2" },
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc3381.poll.start" },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }],
                rule_id: ".org.matrix.msc3930.rule.poll_start_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "org.matrix.msc3381.poll.start" }],
                actions: ["notify"],
                rule_id: ".org.matrix.msc3930.rule.poll_start",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "room_member_count", is: "2" },
                    { kind: "event_match", key: "type", pattern: "org.matrix.msc3381.poll.end" },
                ],
                actions: ["notify", { set_tweak: "sound", value: "default" }],
                rule_id: ".org.matrix.msc3930.rule.poll_end_one_to_one",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "org.matrix.msc3381.poll.end" }],
                actions: ["notify"],
                rule_id: ".org.matrix.msc3930.rule.poll_end",
                default: true,
                enabled: true,
            },
        ],
        sender: [],
        room: [],
        content: [
            {
                actions: ["notify", { set_tweak: "highlight" }, { set_tweak: "sound", value: "default" }],
                rule_id: ".m.rule.contains_user_name",
                default: true,
                pattern: "alice",
                enabled: true,
            },
        ],
        override: [
            { conditions: [], actions: ["dont_notify"], rule_id: ".m.rule.master", default: true, enabled: false },
            {
                conditions: [{ kind: "event_match", key: "content.msgtype", pattern: "m.notice" }],
                actions: ["dont_notify"],
                rule_id: ".m.rule.suppress_notices",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "m.room.member" },
                    { kind: "event_match", key: "content.membership", pattern: "invite" },
                    { kind: "event_match", key: "state_key", pattern: "@alice:example.org" },
                ],
                actions: ["notify", { set_tweak: "highlight", value: false }, { set_tweak: "sound", value: "default" }],
                rule_id: ".m.rule.invite_for_me",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "m.room.member" }],
                actions: ["dont_notify"],
                rule_id: ".m.rule.member_event",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    {
                        kind: "event_property_contains",
                        key: "content.org\\.matrix\\.msc3952\\.mentions.user_ids",
                        value_type: "user_id",
                    },
                ],
                actions: ["notify", { set_tweak: "highlight" }, { set_tweak: "sound", value: "default" }],
                rule_id: ".org.matrix.msc3952.is_user_mention",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "contains_display_name" }],
                actions: ["notify", { set_tweak: "highlight" }, { set_tweak: "sound", value: "default" }],
                rule_id: ".m.rule.contains_display_name",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_property_is", key: "content.org\\.matrix\\.msc3952\\.mentions.room", value: true },
                    { kind: "sender_notification_permission", key: "room" },
                ],
                actions: ["notify", { set_tweak: "highlight" }],
                rule_id: ".org.matrix.msc3952.is_room_mention",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "sender_notification_permission", key: "room" },
                    { kind: "event_match", key: "content.body", pattern: "@room" },
                ],
                actions: ["notify", { set_tweak: "highlight" }],
                rule_id: ".m.rule.roomnotif",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "m.room.tombstone" },
                    { kind: "event_match", key: "state_key", pattern: "" },
                ],
                actions: ["notify", { set_tweak: "highlight" }],
                rule_id: ".m.rule.tombstone",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "m.reaction" }],
                actions: [],
                rule_id: ".m.rule.reaction",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: "event_match", key: "type", pattern: "m.room.server_acl" },
                    { kind: "event_match", key: "state_key", pattern: "" },
                ],
                actions: [],
                rule_id: ".m.rule.room.server_acl",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "event_match", key: "type", pattern: "org.matrix.msc3381.poll.response" }],
                actions: [],
                rule_id: ".org.matrix.msc3930.rule.poll_response",
                default: true,
                enabled: true,
            },
        ],
    },
} as IPushRules);

/**
 * Get rule by id from default rules
 * @param ruleId
 * @returns {IPushRule} matching push rule
 * @returns {PushRuleKind}
 * @throws when no rule is found with ruleId
 */
export const getDefaultRuleWithKind = (ruleId: RuleId | string): { rule: IPushRule; kind: PushRuleKind } => {
    for (const kind of Object.keys(DEFAULT_PUSH_RULES.global)) {
        const rule = DEFAULT_PUSH_RULES.global[kind as PushRuleKind]!.find((r: IPushRule) => r.rule_id === ruleId);
        if (rule) {
            return { rule, kind: kind as PushRuleKind };
        }
    }

    throw new Error(`Could not find default rule for id ${ruleId}`);
};

/**
 * Get rule by id from default rules as an IAnnotatedPushRule
 * @param ruleId
 * @returns
 */
export const getDefaultAnnotatedRule = (ruleId: RuleId | string): IAnnotatedPushRule => {
    const { rule, kind } = getDefaultRuleWithKind(ruleId);

    return {
        ...rule,
        kind,
    };
};

/**
 * Make a push rule with default values
 * @param ruleId
 * @param ruleOverrides
 * @returns IPushRule
 */
export const makePushRule = (ruleId: RuleId | string, ruleOverrides: Partial<IPushRule> = {}): IPushRule => ({
    actions: [],
    enabled: true,
    default: false,
    ...ruleOverrides,
    rule_id: ruleId,
});

export const makeAnnotatedPushRule = (
    kind: PushRuleKind,
    ruleId: RuleId | string,
    ruleOverrides: Partial<IPushRule> = {},
): IAnnotatedPushRule => ({
    ...makePushRule(ruleId, ruleOverrides),
    kind,
});
