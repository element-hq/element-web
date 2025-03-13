/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IAnnotatedPushRule, type PushRuleAction, type PushRuleKind, type RuleId } from "matrix-js-sdk/src/matrix";

export type PushRuleDiff = {
    updated: PushRuleUpdate[];
    added: IAnnotatedPushRule[];
    deleted: PushRuleDeletion[];
};

export type PushRuleDeletion = {
    rule_id: RuleId | string;
    kind: PushRuleKind;
};

export type PushRuleUpdate = {
    rule_id: RuleId | string;
    kind: PushRuleKind;
    enabled?: boolean;
    actions?: PushRuleAction[];
};
