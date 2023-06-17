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

import { IAnnotatedPushRule, IPushRules, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";

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
