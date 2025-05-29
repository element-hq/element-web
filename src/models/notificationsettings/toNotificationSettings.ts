/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IPushRule, type IPushRules, RuleId } from "matrix-js-sdk/src/matrix";

import { NotificationUtils } from "../../notifications";
import { RoomNotifState } from "../../RoomNotifs";
import { type NotificationSettings } from "./NotificationSettings";
import { buildPushRuleMap } from "./PushRuleMap";

function shouldNotify(rules: (IPushRule | null | undefined | false)[]): boolean {
    if (rules.length === 0) {
        return true;
    }
    for (const rule of rules) {
        if (rule === null || rule === undefined || rule === false || !rule.enabled) {
            continue;
        }
        const actions = NotificationUtils.decodeActions(rule.actions);
        if (actions !== null && actions.notify) {
            return true;
        }
    }
    return false;
}

function isMuted(rules: (IPushRule | null | undefined | false)[]): boolean {
    if (rules.length === 0) {
        return false;
    }
    for (const rule of rules) {
        if (rule === null || rule === undefined || rule === false || !rule.enabled) {
            continue;
        }
        const actions = NotificationUtils.decodeActions(rule.actions);
        if (actions !== null && !actions.notify && actions.highlight !== true && actions.sound === undefined) {
            return true;
        }
    }
    return false;
}

function determineSound(rules: (IPushRule | null | undefined | false)[]): string | undefined {
    for (const rule of rules) {
        if (rule === null || rule === undefined || rule === false || !rule.enabled) {
            continue;
        }
        const actions = NotificationUtils.decodeActions(rule.actions);
        if (actions !== null && actions.notify && actions.sound !== undefined) {
            return actions.sound;
        }
    }
    return undefined;
}

export function toNotificationSettings(
    pushRules: IPushRules,
    supportsIntentionalMentions: boolean,
): NotificationSettings {
    const standardRules = buildPushRuleMap(pushRules);
    const contentRules = pushRules.global.content?.filter((rule) => !rule.rule_id.startsWith(".")) ?? [];
    const dmRules = [standardRules.get(RuleId.DM), standardRules.get(RuleId.EncryptedDM)];
    const roomRules = [standardRules.get(RuleId.Message), standardRules.get(RuleId.EncryptedMessage)];
    return {
        globalMute: standardRules.get(RuleId.Master)?.enabled ?? false,
        defaultLevels: {
            room: shouldNotify(roomRules) ? RoomNotifState.AllMessages : RoomNotifState.MentionsOnly,
            dm: shouldNotify(dmRules) ? RoomNotifState.AllMessages : RoomNotifState.MentionsOnly,
        },
        sound: {
            calls: determineSound([standardRules.get(RuleId.IncomingCall)]),
            mentions: determineSound([
                supportsIntentionalMentions && standardRules.get(RuleId.IsUserMention),
                standardRules.get(RuleId.ContainsUserName),
                standardRules.get(RuleId.ContainsDisplayName),
                ...contentRules,
            ]),
            people: determineSound(dmRules),
        },
        activity: {
            bot_notices: !isMuted([standardRules.get(RuleId.SuppressNotices)]),
            invite: shouldNotify([standardRules.get(RuleId.InviteToSelf)]),
            status_event: shouldNotify([standardRules.get(RuleId.MemberEvent), standardRules.get(RuleId.Tombstone)]),
        },
        mentions: {
            user: shouldNotify([
                supportsIntentionalMentions && standardRules.get(RuleId.IsUserMention),
                standardRules.get(RuleId.ContainsUserName),
                standardRules.get(RuleId.ContainsDisplayName),
            ]),
            room: shouldNotify([
                supportsIntentionalMentions && standardRules.get(RuleId.IsRoomMention),
                standardRules.get(RuleId.AtRoomNotification),
            ]),
            keywords: shouldNotify(contentRules),
        },
        keywords: contentRules.map((it) => it.pattern!),
    };
}
