/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Fixtures } from "@playwright/test";

import { Services } from "../../../services.ts";

export const uiaLongSessionTimeoutHomeserver: Fixtures<{}, Services> = {
    synapseConfigOptions: [
        async ({ synapseConfigOptions }, use) => {
            await use({
                ...synapseConfigOptions,
                ui_auth: {
                    session_timeout: "300s",
                },
            });
        },
        { scope: "worker" },
    ],
};
