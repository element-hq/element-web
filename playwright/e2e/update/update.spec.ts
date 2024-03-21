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

import { test, expect } from "../../element-web-test";

test.describe("Update", () => {
    const NEW_VERSION = "some-new-version";

    test.use({
        displayName: "Ursa",
    });

    test.beforeEach(async ({ context }) => {
        await context.route("/version*", async (route) => {
            await route.fulfill({
                body: NEW_VERSION,
                headers: {
                    "Content-Type": "test/plain",
                },
            });
        });
    });

    test("should navigate to ?updated=$VERSION if realises it is immediately out of date on load", async ({
        page,
        user,
    }) => {
        await expect(page).toHaveURL(/updated=/);
        expect(new URL(page.url()).searchParams.get("updated")).toEqual(NEW_VERSION);
    });
});
