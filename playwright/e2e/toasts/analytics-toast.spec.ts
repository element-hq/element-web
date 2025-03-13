/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test } from "../../element-web-test";

test.describe("Analytics Toast", () => {
    test.use({
        displayName: "Tod",
    });

    test("should not show an analytics toast if config has nothing about posthog", async ({ user, toasts }) => {
        await toasts.rejectToast("Notifications");
        await toasts.assertNoToasts();
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

        test.beforeEach(async ({ user, toasts }) => {
            await toasts.rejectToast("Notifications");
        });

        test("should show an analytics toast which can be accepted", async ({ user, toasts }) => {
            await toasts.acceptToast("Help improve Element");
            await toasts.assertNoToasts();
        });

        test("should show an analytics toast which can be rejected", async ({ user, toasts }) => {
            await toasts.rejectToast("Help improve Element");
            await toasts.assertNoToasts();
        });
    });
});
