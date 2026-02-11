/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PermalinkParts } from "../../../../src/utils/permalinks/PermalinkConstructor";
import MatrixSchemePermalinkConstructor from "../../../../src/utils/permalinks/MatrixSchemePermalinkConstructor";

describe("MatrixSchemePermalinkConstructor", () => {
    const peramlinkConstructor = new MatrixSchemePermalinkConstructor();

    describe("parsePermalink", () => {
        it("should strip ?action=chat from user links", () => {
            expect(peramlinkConstructor.parsePermalink("matrix:u/user:example.com?action=chat")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });
    });
});
