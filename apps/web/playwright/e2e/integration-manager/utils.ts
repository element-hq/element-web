/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ElementAppPage } from "../../pages/ElementAppPage";

export async function openIntegrationManager(app: ElementAppPage) {
    const { page } = app;
    await app.toggleRoomInfoPanel();
    await page.getByRole("menuitem", { name: "Extensions" }).click();
    await page.getByRole("button", { name: "Add extensions" }).click();
}
