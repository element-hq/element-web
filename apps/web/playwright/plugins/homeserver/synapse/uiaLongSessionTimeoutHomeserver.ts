/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Fixtures } from "../../../element-web-test.ts";

export const uiaLongSessionTimeoutHomeserver: Fixtures = {
    synapseConfig: [
        async ({ synapseConfig }, use) => {
            await use({
                ...synapseConfig,
                ui_auth: {
                    session_timeout: "300s",
                },
            });
        },
        { scope: "worker" },
    ],
};
