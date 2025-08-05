/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixAuthenticationServiceContainer } from "../../../testcontainers/mas.ts";
import { type Fixtures } from "../../../element-web-test.ts";

export const masHomeserver: Fixtures = {
    mas: [
        async ({ _homeserver: homeserver, logger, network, postgres, mailpit }, use) => {
            const secret = "AnotherRandomSecret";

            const limits = { burst: 10, per_second: 10 };
            const container = await new MatrixAuthenticationServiceContainer(postgres)
                .withNetwork(network)
                .withNetworkAliases("mas")
                .withLogConsumer(logger.getConsumer("mas"))
                .withConfig({
                    matrix: {
                        kind: "synapse",
                        homeserver: "localhost",
                        secret,
                        endpoint: "http://homeserver:8008",
                    },
                    rate_limiting: {
                        login: {
                            per_ip: limits,
                            per_account: limits,
                        },
                        registration: limits,
                        email_authentication: {
                            per_ip: limits,
                            per_address: limits,
                            emails_per_session: limits,
                            attempt_per_session: limits,
                        },
                        account_recovery: {
                            per_ip: limits,
                            per_address: limits,
                        },
                    },
                })
                .start();

            homeserver.withConfig({
                enable_registration: undefined,
                enable_registration_without_verification: undefined,
                disable_msisdn_registration: undefined,
                password_config: undefined,
                matrix_authentication_service: {
                    enabled: true,
                    endpoint: "http://mas:8080/",
                    secret,
                },
            });

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],

    context: async ({ homeserverType, context }, use, testInfo) => {
        testInfo.skip(homeserverType !== "synapse", "does not yet support MAS");
        await use(context);
    },
};
