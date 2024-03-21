/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
