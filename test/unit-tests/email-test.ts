/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { looksValid } from "../../src/email";

describe("looksValid", () => {
    it.each([
        ["", false],
        ["alice", false],
        ["@", false],
        ["@alice:example.com", false],
        ["@b.org", false],
        ["alice@example", false],
        ["a@b.org", true],
        ["alice@example.com", true],
    ])("for »%s« should return %s", (value: string, expected: boolean) => {
        expect(looksValid(value)).toBe(expected);
    });
});
