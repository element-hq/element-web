/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToastIfExists } from "@element-hq/element-web-playwright-common";

import { isDendrite } from "../../plugins/homeserver/dendrite";
import { checkRetentionInRoom } from "./utils";
import { test } from "../../element-web-test";

const ONE_MINUTE_STR = "60s";

test.use({
    synapseConfig: {
        retention: {
            enabled: true,
            default_policy: {
                max_lifetime: ONE_MINUTE_STR,
            },
            allowed_lifetime_min: ONE_MINUTE_STR,
            allowed_lifetime_max: ONE_MINUTE_STR,
        },
        experimental_features: {
            msc1763_enabled: true,
        },
    },
});
test.describe("global retention rules", () => {
    test.skip(isDendrite, "dendrite does not support retention");
    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "Bob",
        },
        labsFlags: ["feature_retention"],
    });
    test.beforeEach(async ({ app, homeserver, page, user }) => {
        await rejectToastIfExists(page, "Verify this device");
        await rejectToastIfExists(page, "Notifications");
        await page.clock.install();
    });

    test("should apply", async ({ app, bot, page }) => {
        const roomId = await app.client.createRoom({
            name: "Test",
            invite: [bot.credentials.userId],
        });
        await checkRetentionInRoom({ app, bot, page }, roomId);
    });
});
