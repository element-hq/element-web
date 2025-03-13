/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import withValidation from "../../../../src/components/views/elements/Validation";

describe("Validation", () => {
    it("should handle 0 rules", () => {
        const handler = withValidation({
            rules: [],
        });
        return expect(
            handler({
                value: "value",
                focused: true,
            }),
        ).resolves.toEqual(
            expect.objectContaining({
                valid: true,
            }),
        );
    });
});
