/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { acceptToast, assertNoToasts, rejectToast } from "@element-hq/element-web-playwright-common/src/utils/toasts";

import { test } from "../../element-web-test";

test.describe("Analytics Toast", () => {
    test.use({
        displayName: "Tod",
    });

    test("should not show an analytics toast if config has nothing about posthog", async ({ user, page }) => {
        await rejectToast(page, "Notifications");
        await assertNoToasts(page);
    });

    test.describe("with posthog enabled", () => {
        test.use({
            config: {
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
            },
        });

        test.beforeEach(async ({ user, page }) => {
            await rejectToast(page, "Notifications");
        });

        test("should show an analytics toast which can be accepted", async ({ user, page }) => {
            await acceptToast(page, "Help improve Element");
            await assertNoToasts(page);
        });

        test("should show an analytics toast which can be rejected", async ({ user, page }) => {
            await rejectToast(page, "Help improve Element");
            await assertNoToasts(page);
        });
    });
});
