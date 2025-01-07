/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Fixtures } from "@playwright/test";

import { Options, Services } from "../../../services.ts";

export const emailHomeserver: Fixtures<Services & Options, {}, Services & Options> = {
    _homeserver: async ({ homeserverType, _homeserver: container, mailhog }, use, testInfo) => {
        testInfo.skip(homeserverType !== "synapse", "does not yet support MAS");
        container.withConfig({
            enable_registration_without_verification: undefined,
            disable_msisdn_registration: undefined,
            registrations_require_3pid: ["email"],
            email: {
                smtp_host: "mailhog",
                smtp_port: 1025,
                notif_from: "Your Friendly %(app)s homeserver <noreply@example.com>",
                app_name: "my_branded_matrix_server",
            },
        });
        await use(container);
    },
};
