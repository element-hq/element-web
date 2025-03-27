/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type IPushRule, type PushRuleAction, type PushRuleKind } from "matrix-js-sdk/src/matrix";

/**
 * Sets the actions for a given push rule id and kind
 * When actions are falsy, disables the rule
 * @param matrixClient - cli
 * @param ruleId - rule id to update
 * @param kind - PushRuleKind
 * @param actions - push rule actions to set for rule
 */
export const updatePushRuleActions = async (
    matrixClient: MatrixClient,
    ruleId: IPushRule["rule_id"],
    kind: PushRuleKind,
    actions?: PushRuleAction[],
): Promise<void> => {
    if (!actions) {
        await matrixClient.setPushRuleEnabled("global", kind, ruleId, false);
    } else {
        await matrixClient.setPushRuleActions("global", kind, ruleId, actions);
        await matrixClient.setPushRuleEnabled("global", kind, ruleId, true);
    }
};

interface PushRuleAndKind {
    rule: IPushRule;
    kind: PushRuleKind;
}

/**
 * Update push rules with given actions
 * Where they already exist for current user
 * Rules are updated sequentially and stop at first error
 * @param matrixClient - cli
 * @param ruleIds - RuleIds of push rules to attempt to set actions for
 * @param actions - push rule actions to set for rule
 * @returns resolves when all rules have been updated
 * @returns rejects when a rule update fails
 */
export const updateExistingPushRulesWithActions = async (
    matrixClient: MatrixClient,
    ruleIds?: IPushRule["rule_id"][],
    actions?: PushRuleAction[],
): Promise<void> => {
    const rules: PushRuleAndKind[] | undefined = ruleIds
        ?.map((ruleId) => matrixClient.pushProcessor.getPushRuleAndKindById(ruleId))
        .filter((n: PushRuleAndKind | null): n is PushRuleAndKind => Boolean(n));

    if (!rules?.length) {
        return;
    }
    for (const { kind, rule } of rules) {
        await updatePushRuleActions(matrixClient, rule.rule_id, kind, actions);
    }
};
