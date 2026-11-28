/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { JoinRule } from "matrix-js-sdk/src/matrix";

/**
 * Whether the join rule is `Knock` or `KnockRestricted`.
 */
export function isKnockJoinRule(joinRule?: JoinRule | string): boolean {
    return joinRule === JoinRule.Knock || joinRule === JoinRule.KnockRestricted;
}
