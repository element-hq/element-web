/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test } from "../../element-web-test";
import { doTokenRegistration } from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { legacyOAuthHomeserver } from "../../plugins/homeserver/synapse/legacyOAuthHomeserver.ts";

test.use(legacyOAuthHomeserver);

// tests for old-style SSO login, in which we exchange tokens with Synapse, and Synapse talks to an auth server
test.describe("SSO login", () => {
    test.skip(isDendrite, "does not yet support SSO");

    test("logs in with SSO and lands on the home screen", async ({ page, homeserver }, testInfo) => {
        // If this test fails with a screen showing "Timeout connecting to remote server", it is most likely due to
        // your firewall settings: Synapse is unable to reach the OIDC server.
        //
        // If you are using ufw, try something like:
        //    sudo ufw allow in on docker0
        //
        await doTokenRegistration(page, homeserver, testInfo);
    });
});
