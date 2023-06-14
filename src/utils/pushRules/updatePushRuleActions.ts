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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { IPushRule, PushRuleAction, PushRuleKind } from "matrix-js-sdk/src/matrix";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

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
    const pushProcessor = new PushProcessor(matrixClient);

    const rules: PushRuleAndKind[] | undefined = ruleIds
        ?.map((ruleId) => pushProcessor.getPushRuleAndKindById(ruleId))
        .filter((n: PushRuleAndKind | null): n is PushRuleAndKind => Boolean(n));

    if (!rules?.length) {
        return;
    }
    for (const { kind, rule } of rules) {
        await updatePushRuleActions(matrixClient, rule.rule_id, kind, actions);
    }
};
