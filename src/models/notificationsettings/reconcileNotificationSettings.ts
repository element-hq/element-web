/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IPushRules, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";
import { deepCompare } from "matrix-js-sdk/src/utils";

import { NotificationUtils } from "../../notifications";
import { StandardActions } from "../../notifications/StandardActions";
import { RoomNotifState } from "../../RoomNotifs";
import { type NotificationSettings } from "./NotificationSettings";
import { type PushRuleDiff, type PushRuleUpdate } from "./PushRuleDiff";
import { buildPushRuleMap } from "./PushRuleMap";

function toStandardRules(
    model: NotificationSettings,
    supportsIntentionalMentions: boolean,
): Map<RuleId | string, PushRuleUpdate> {
    const standardRules = new Map<RuleId | string, PushRuleUpdate>();

    standardRules.set(RuleId.Master, {
        rule_id: RuleId.Master,
        kind: PushRuleKind.Override,
        enabled: model.globalMute,
    });

    standardRules.set(RuleId.EncryptedMessage, {
        rule_id: RuleId.EncryptedMessage,
        kind: PushRuleKind.Underride,
        enabled: true,
        actions: NotificationUtils.encodeActions({
            notify: model.defaultLevels.room === RoomNotifState.AllMessages,
            highlight: false,
        }),
    });
    standardRules.set(RuleId.Message, {
        rule_id: RuleId.Message,
        kind: PushRuleKind.Underride,
        enabled: true,
        actions: NotificationUtils.encodeActions({
            notify: model.defaultLevels.room === RoomNotifState.AllMessages,
            highlight: false,
        }),
    });
    standardRules.set(RuleId.EncryptedDM, {
        rule_id: RuleId.EncryptedDM,
        kind: PushRuleKind.Underride,
        enabled: true,
        actions: NotificationUtils.encodeActions({
            notify: model.defaultLevels.dm === RoomNotifState.AllMessages,
            highlight: false,
            sound: model.sound.people,
        }),
    });
    standardRules.set(RuleId.DM, {
        rule_id: RuleId.DM,
        kind: PushRuleKind.Underride,
        enabled: true,
        actions: NotificationUtils.encodeActions({
            notify: model.defaultLevels.dm === RoomNotifState.AllMessages,
            highlight: false,
            sound: model.sound.people,
        }),
    });

    standardRules.set(RuleId.SuppressNotices, {
        rule_id: RuleId.SuppressNotices,
        kind: PushRuleKind.Override,
        enabled: !model.activity.bot_notices,
        actions: StandardActions.ACTION_DONT_NOTIFY,
    });
    standardRules.set(RuleId.InviteToSelf, {
        rule_id: RuleId.InviteToSelf,
        kind: PushRuleKind.Override,
        enabled: model.activity.invite,
        actions: NotificationUtils.encodeActions({
            notify: true,
            highlight: false,
            sound: model.sound.people,
        }),
    });
    standardRules.set(RuleId.MemberEvent, {
        rule_id: RuleId.MemberEvent,
        kind: PushRuleKind.Override,
        enabled: true,
        actions: model.activity.status_event ? StandardActions.ACTION_NOTIFY : StandardActions.ACTION_DONT_NOTIFY,
    });

    const mentionActions = NotificationUtils.encodeActions({
        notify: true,
        sound: model.sound.mentions,
        highlight: true,
    });
    const userMentionActions = model.mentions.user ? mentionActions : StandardActions.ACTION_DONT_NOTIFY;
    if (supportsIntentionalMentions) {
        standardRules.set(RuleId.IsUserMention, {
            rule_id: RuleId.IsUserMention,
            kind: PushRuleKind.Override,
            enabled: true,
            actions: userMentionActions,
        });
    }
    standardRules.set(RuleId.ContainsDisplayName, {
        rule_id: RuleId.ContainsDisplayName,
        kind: PushRuleKind.Override,
        enabled: true,
        actions: userMentionActions,
    });
    standardRules.set(RuleId.ContainsUserName, {
        rule_id: RuleId.ContainsUserName,
        kind: PushRuleKind.ContentSpecific,
        enabled: true,
        actions: userMentionActions,
    });

    const roomMentionActions = model.mentions.room ? StandardActions.ACTION_NOTIFY : StandardActions.ACTION_DONT_NOTIFY;
    if (supportsIntentionalMentions) {
        standardRules.set(RuleId.IsRoomMention, {
            rule_id: RuleId.IsRoomMention,
            kind: PushRuleKind.Override,
            enabled: true,
            actions: roomMentionActions,
        });
    }
    standardRules.set(RuleId.AtRoomNotification, {
        rule_id: RuleId.AtRoomNotification,
        kind: PushRuleKind.Override,
        enabled: true,
        actions: roomMentionActions,
    });

    standardRules.set(RuleId.Tombstone, {
        rule_id: RuleId.Tombstone,
        kind: PushRuleKind.Override,
        enabled: model.activity.status_event,
        actions: StandardActions.ACTION_HIGHLIGHT,
    });

    standardRules.set(RuleId.IncomingCall, {
        rule_id: RuleId.IncomingCall,
        kind: PushRuleKind.Underride,
        enabled: true,
        actions: NotificationUtils.encodeActions({
            notify: true,
            sound: model.sound.calls,
        }),
    });

    return standardRules;
}

export function reconcileNotificationSettings(
    pushRules: IPushRules,
    model: NotificationSettings,
    supportsIntentionalMentions: boolean,
): PushRuleDiff {
    const changes: PushRuleDiff = {
        updated: [],
        added: [],
        deleted: [],
    };

    const oldRules = buildPushRuleMap(pushRules);
    const newRules = toStandardRules(model, supportsIntentionalMentions);

    for (const rule of newRules.values()) {
        const original = oldRules.get(rule.rule_id);
        let changed = false;
        if (original === undefined) {
            changed = true;
        } else if (rule.enabled !== undefined && rule.enabled !== original.enabled) {
            changed = true;
        } else if (rule.actions !== undefined) {
            const originalActions = NotificationUtils.decodeActions(original.actions);
            const actions = NotificationUtils.decodeActions(rule.actions);
            if (originalActions === null || actions === null) {
                changed = true;
            } else if (!deepCompare(actions, originalActions)) {
                changed = true;
            }
        }
        if (changed) {
            changes.updated.push(rule);
        }
    }

    const mentionActions = NotificationUtils.encodeActions({
        notify: true,
        sound: model.sound.mentions,
        highlight: true,
    });
    const contentRules = pushRules.global.content?.filter((rule) => !rule.rule_id.startsWith(".")) ?? [];
    const newKeywords = new Set(model.keywords);
    for (const rule of contentRules) {
        if (!newKeywords.has(rule.pattern!)) {
            changes.deleted.push({
                rule_id: rule.rule_id,
                kind: PushRuleKind.ContentSpecific,
            });
        } else {
            let changed = false;
            if (rule.enabled !== model.mentions.keywords) {
                changed = true;
            } else if (rule.actions !== undefined) {
                const originalActions = NotificationUtils.decodeActions(rule.actions);
                const actions = NotificationUtils.decodeActions(mentionActions);
                if (originalActions === null || actions === null) {
                    changed = true;
                } else if (!deepCompare(actions, originalActions)) {
                    changed = true;
                }
            }
            if (changed) {
                changes.updated.push({
                    rule_id: rule.rule_id,
                    kind: PushRuleKind.ContentSpecific,
                    enabled: model.mentions.keywords,
                    actions: mentionActions,
                });
            }
        }
        newKeywords.delete(rule.pattern!);
    }
    for (const keyword of newKeywords) {
        changes.added.push({
            rule_id: keyword,
            kind: PushRuleKind.ContentSpecific,
            default: false,
            enabled: model.mentions.keywords,
            pattern: keyword,
            actions: mentionActions,
        });
    }

    return changes;
}
