/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IAnnotatedPushRule, type IPushRules, PushRuleKind, type RuleId } from "matrix-js-sdk/src/matrix";

export type PushRuleMap = Map<RuleId | string, IAnnotatedPushRule>;

export function buildPushRuleMap(rulesets: IPushRules): PushRuleMap {
    const rules = new Map<RuleId | string, IAnnotatedPushRule>();

    for (const kind of Object.values(PushRuleKind)) {
        for (const rule of rulesets.global[kind] ?? []) {
            if (rule.rule_id.startsWith(".")) {
                rules.set(rule.rule_id, { ...rule, kind });
            }
        }
    }

    return rules;
}
