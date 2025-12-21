/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import BaseEventIndexManager from "../../../src/indexing/BaseEventIndexManager";

describe("BaseEventIndexManager", () => {
    it("initEventIndex throws unimplemented error", async () => {
        // BaseEventIndexManager is abstract but has no abstract methods, so we can instantiate a trivial subclass.
        class TestManager extends BaseEventIndexManager {}
        const mgr = new TestManager();

        await expect(mgr.initEventIndex("@user:example.org", "DEVICE", "ngram")).rejects.toThrow("Unimplemented");
    });
});
