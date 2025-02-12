/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type MatrixEvent,
    EventType,
    type RuleId,
    type IAnnotatedPushRule,
} from "matrix-js-sdk/src/matrix";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { logger } from "matrix-js-sdk/src/logger";

import { VectorPushRulesDefinitions, type VectorPushRuleDefinition } from "../../notifications";
import { updateExistingPushRulesWithActions } from "./updatePushRuleActions";

const pushRuleAndKindToAnnotated = (
    ruleAndKind: ReturnType<PushProcessor["getPushRuleAndKindById"]>,
): IAnnotatedPushRule | undefined =>
    ruleAndKind
        ? {
              ...ruleAndKind.rule,
              kind: ruleAndKind.kind,
          }
        : undefined;

/**
 * Checks that any synced rules that exist a given rule are in sync
 * And updates any that are out of sync
 * Ignores ruleIds that do not exist for the user
 * @param matrixClient - cli
 * @param pushProcessor - processor used to retrieve current state of rules
 * @param ruleId - primary rule
 * @param definition - VectorPushRuleDefinition of the primary rule
 */
const monitorSyncedRule = async (
    matrixClient: MatrixClient,
    pushProcessor: PushProcessor,
    ruleId: RuleId | string,
    definition: VectorPushRuleDefinition,
): Promise<void> => {
    const primaryRule = pushRuleAndKindToAnnotated(pushProcessor.getPushRuleAndKindById(ruleId));

    if (!primaryRule) {
        return;
    }
    const syncedRules: IAnnotatedPushRule[] | undefined = definition.syncedRuleIds
        ?.map((ruleId) => pushRuleAndKindToAnnotated(pushProcessor.getPushRuleAndKindById(ruleId)))
        .filter((n?: IAnnotatedPushRule): n is IAnnotatedPushRule => Boolean(n));

    // no synced rules to manage
    if (!syncedRules?.length) {
        return;
    }

    const primaryRuleVectorState = definition.ruleToVectorState(primaryRule);

    const outOfSyncRules = syncedRules.filter(
        (syncedRule) =>
            syncedRule.enabled !== primaryRule.enabled ||
            definition.ruleToVectorState(syncedRule) !== primaryRuleVectorState,
    );

    if (outOfSyncRules.length) {
        await updateExistingPushRulesWithActions(
            matrixClient,
            // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
            outOfSyncRules.map(({ rule_id }) => rule_id),
            primaryRule.enabled ? primaryRule.actions : undefined,
        );
    }
};

/**
 * On changes to m.push_rules account data,
 * check that synced push rules are in sync with their primary rule,
 * and update any out of sync rules.
 * synced rules are defined in VectorPushRulesDefinitions
 * If updating a rule fails for any reason,
 * the error is caught and handled silently
 * @param accountDataEvent - MatrixEvent
 * @param matrixClient - cli
 * @returns Resolves when updates are complete
 */
export const monitorSyncedPushRules = async (
    accountDataEvent: MatrixEvent | undefined,
    matrixClient: MatrixClient,
): Promise<void> => {
    if (accountDataEvent?.getType() !== EventType.PushRules) {
        return;
    }
    const pushProcessor = new PushProcessor(matrixClient);

    Object.entries(VectorPushRulesDefinitions).forEach(async ([ruleId, definition]) => {
        try {
            await monitorSyncedRule(matrixClient, pushProcessor, ruleId, definition);
        } catch (error) {
            logger.error(`Failed to fully synchronise push rules for ${ruleId}`, error);
        }
    });
};
