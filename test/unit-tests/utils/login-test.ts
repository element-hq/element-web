/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import MatrixChat from "../../../src/components/structures/MatrixChat.tsx";
import { isLoggedIn } from "../../../src/utils/login.ts";
import Views from "../../../src/Views.ts";

describe("isLoggedIn", () => {
    it("should return true if MatrixChat state view is LOGGED_IN", () => {
        window.matrixChat = {
            state: {
                view: Views.LOGGED_IN,
            },
        } as unknown as MatrixChat;

        expect(isLoggedIn()).toBe(true);
    });
});
