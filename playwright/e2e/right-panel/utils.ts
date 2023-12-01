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

import { type Page, expect } from "@playwright/test";

import { ElementAppPage } from "../../pages/ElementAppPage";

export async function viewRoomSummaryByName(page: Page, app: ElementAppPage, name: string): Promise<void> {
    await app.viewRoomByName(name);
    await page.getByRole("button", { name: "Room info" }).click();
    return checkRoomSummaryCard(page, name);
}

export async function checkRoomSummaryCard(page: Page, name: string): Promise<void> {
    await expect(page.locator(".mx_RoomSummaryCard")).toBeVisible();
    await expect(page.locator(".mx_RoomSummaryCard")).toContainText(name);
}
