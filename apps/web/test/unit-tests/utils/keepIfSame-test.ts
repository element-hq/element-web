/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { keepIfSame } from "../../../src/utils/keepIfSame";

describe("keepIfSame", () => {
    it("returns the next value if the current and next values are not deeply equal", () => {
        const current = { a: 1 };
        const next = { a: 2 };
        expect(keepIfSame(current, next)).toBe(next);
    });

    it("returns the current value if the current and next values are deeply equal", () => {
        const current = { a: 1 };
        const next = { a: 1 };
        expect(keepIfSame(current, next)).toBe(current);
    });
});
