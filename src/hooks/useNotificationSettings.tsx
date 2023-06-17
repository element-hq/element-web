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

import { IPushRules, MatrixClient } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NotificationSettings } from "../models/notificationsettings/NotificationSettings";
import { PushRuleDiff } from "../models/notificationsettings/PushRuleDiff";
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
        updatePushRules().catch((err) => console.error(err));
    }, [cli, updatePushRules]);

    const reconcile = useCallback(
        (model: NotificationSettings) => {
            if (pushRules.current !== null) {
                setModel(model);
                const changes = reconcileNotificationSettings(pushRules.current, model, supportsIntentionalMentions);
                applyChanges(cli, changes)
                    .then(updatePushRules)
                    .catch((err) => console.error(err));
            }
        },
        [cli, updatePushRules, supportsIntentionalMentions],
    );

    return { model, hasPendingChanges, reconcile };
}
