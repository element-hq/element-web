/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";
import { JoinRule } from "matrix-js-sdk/src/matrix";

import { isKnockJoinRule } from "./isKnockJoinRule";

describe("isKnockJoinRule", () => {
    it.each([
        [JoinRule.Knock, true],
        [JoinRule.KnockRestricted, true],
        [JoinRule.Restricted, false],
        [JoinRule.Public, false],
        [undefined, false],
    ])("returns the right value for %s", (joinRule, expected) => {
        expect(isKnockJoinRule(joinRule)).toBe(expected);
    });
});
