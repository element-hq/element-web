/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IPushRules, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    reconcile: (model: NotificationSettings) => void;
};

export function useNotificationSettings(cli: MatrixClient): UseNotificationSettings {
    const run = useLinearisedPromise<void>();
    const supportsIntentionalMentions = useMemo(() => cli.supportsIntentionalMentions(), [cli]);

    const pushRules = useRef<IPushRules | null>(null);
    const [model, setModel] = useState<NotificationSettings | null>(null);
    const [hasPendingChanges, setPendingChanges] = useState<boolean>(false);
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
            run(async () => {
                if (pushRules.current !== null) {
                    const changes = reconcileNotificationSettings(
                        pushRules.current,
                        model,
                        supportsIntentionalMentions,
                    );
                    await applyChanges(cli, changes);
                    await updatePushRules();
                }
            }).catch((err) => console.error(err));
        },
        [run, supportsIntentionalMentions, cli, updatePushRules],
    );

    return { model, hasPendingChanges, reconcile };
}

function useLinearisedPromise<T>(): (fun: () => Promise<T>) => Promise<T> {
    const lastPromise = useRef<Promise<T> | null>(null);

    return useCallback((fun: () => Promise<T>): Promise<T> => {
        let next: Promise<T>;
        if (lastPromise.current === null) {
            next = fun();
        } else {
            next = lastPromise.current.then(fun);
        }
        lastPromise.current = next;
        return next;
    }, []);
}
