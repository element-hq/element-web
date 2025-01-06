/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { logIntoElement } from "./utils";

test.describe("Complete security", () => {
    test.use({
        displayName: "Jeff",
        config: {
            // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
            // We point that to a guaranteed-invalid domain.
            default_server_config: {
                "m.homeserver": {
                    base_url: "https://server.invalid",
                },
            },
        },
    });

    test("should go straight to the welcome screen if we have no signed device", async ({
        page,
        homeserver,
        credentials,
    }) => {
        await logIntoElement(page, credentials);
        await expect(page.getByText("Welcome Jeff", { exact: true })).toBeVisible();
    });

    // see also "Verify device during login with SAS" in `verifiction.spec.ts`.
});
