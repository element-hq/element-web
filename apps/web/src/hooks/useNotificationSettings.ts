/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IPushRules, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { type NotificationSettings } from "../models/notificationsettings/NotificationSettings";
import { type PushRuleDiff } from "../models/notificationsettings/PushRuleDiff";
import { reconcileNotificationSettings } from "../models/notificationsettings/reconcileNotificationSettings";
import { toNotificationSettings } from "../models/notificationsettings/toNotificationSettings";

async function applyChanges(cli: MatrixClient, changes: PushRuleDiff): Promise<void> {
    await Promise.all(changes.deleted.map((change) => cli.deletePushRule("global", change.kind, change.rule_id)));
    await Promise.all(changes.added.map((change) => cli.addPushRule("global", change.kind, change.rule_id, change)));
    await Promise.all(
        changes.updated.map(async (change) => {
            if (change.enabled !== undefined) {
                await cli.setPushRuleEnabled("global", change.kind, change.rule_id, change.enabled);
            }
            if (change.actions !== undefined) {
                await cli.setPushRuleActions("global", change.kind, change.rule_id, change.actions);
            }
        }),
    );
}

type UseNotificationSettings = {
    model: NotificationSettings | null;
    hasPendingChanges: boolean;
    /**
     * The error from the last reconciliation attempt, or null if it succeeded.
     */
    reconciliationError: unknown;
    reconcile: (model: NotificationSettings) => void;
};

export function useNotificationSettings(cli: MatrixClient): UseNotificationSettings {
    const run = useLinearisedPromise<void>();
    const supportsIntentionalMentions = useMemo(() => cli.supportsIntentionalMentions(), [cli]);

    const pushRules = useRef<IPushRules | null>(null);
    const [model, setModel] = useState<NotificationSettings | null>(null);
    const [hasPendingChanges, setPendingChanges] = useState<boolean>(false);
    const [reconciliationError, setReconciliationError] = useState<unknown>(null);
    const updatePushRules = useCallback(async () => {
        const rules = await cli.getPushRules();
        const model = toNotificationSettings(rules, supportsIntentionalMentions);
        const pendingChanges = reconcileNotificationSettings(rules, model, supportsIntentionalMentions);
        pushRules.current = rules;
        setPendingChanges(
            pendingChanges.updated.length > 0 || pendingChanges.added.length > 0 || pendingChanges.deleted.length > 0,
        );
        setModel(model);
    }, [cli, supportsIntentionalMentions]);

    useEffect(() => {
        run(updatePushRules).catch((err) => console.error(err));
    }, [cli, run, updatePushRules]);

    const reconcile = useCallback(
        (model: NotificationSettings) => {
            setModel(model);
            setReconciliationError(null);
            run(async () => {
                if (pushRules.current !== null) {
                    const changes = reconcileNotificationSettings(
                        pushRules.current,
                        model,
                        supportsIntentionalMentions,
                    );
                    try {
                        await applyChanges(cli, changes);
                        await updatePushRules();
                    } catch (err) {
                        // Part of the diff may already have been applied. Re-read the rules so a
                        // retry works out what is still left to do; repeating a delete the server
                        // has already honoured would just be rejected. The model deliberately
                        // keeps the user's choice — that is what the retry re-applies.
                        pushRules.current = await cli.getPushRules().catch(() => pushRules.current);
                        throw err;
                    }
                }
            }).then(
                () => setReconciliationError(null),
                (err) => {
                    // Surfaced to the user by the caller; without this the failure was silent.
                    logger.error("Failed to reconcile notification settings", err);
                    setReconciliationError(err);
                },
            );
        },
        [run, supportsIntentionalMentions, cli, updatePushRules],
    );

    return { model, hasPendingChanges, reconciliationError, reconcile };
}

function useLinearisedPromise<T>(): (fun: () => Promise<T>) => Promise<T> {
    const lastPromise = useRef<Promise<T> | null>(null);

    return useCallback((fun: () => Promise<T>): Promise<T> => {
        let next: Promise<T>;
        if (lastPromise.current === null) {
            next = fun();
        } else {
            // Queue behind the previous task whether it fulfilled or rejected. Chaining on
            // fulfilment alone leaves a rejected promise at the head of the queue forever, so
            // every later task — a retry of the failed one included — would skip its own body
            // and re-report that first error instead of ever running.
            next = lastPromise.current.then(fun, fun);
        }
        lastPromise.current = next;
        return next;
    }, []);
}
