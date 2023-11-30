/*
Copyright 2023 Suguru Hirahara

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

test.describe("LeftPanel", () => {
    test.use({
        displayName: "Hanako",
    });

    test("should render the Rooms list", async ({ page, app, user }) => {
        // create rooms and check room names are correct
        for (const name of ["Apple", "Pineapple", "Orange"]) {
            await app.client.createRoom({ name });
            await expect(page.getByRole("treeitem", { name })).toBeVisible();
        }
    });
});
