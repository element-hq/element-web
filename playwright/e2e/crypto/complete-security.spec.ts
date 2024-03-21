/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { logIntoElement } from "./utils";

test.describe("Complete security", () => {
    test.use({
        displayName: "Jeff",
    });

    test("should go straight to the welcome screen if we have no signed device", async ({
        page,
        homeserver,
        credentials,
    }) => {
        await logIntoElement(page, homeserver, credentials);
        await expect(page.getByText("Welcome Jeff", { exact: true })).toBeVisible();
    });

    // see also "Verify device during login with SAS" in `verifiction.spec.ts`.
});
