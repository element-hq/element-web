/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixAuthenticationServiceContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

import { type Fixtures } from "../../../element-web-test.ts";

export const masHomeserver: Fixtures = {
    mas: [
        async ({ _homeserver: homeserver, logger, network, postgres, mailpit }, use) => {
            const config = {
                clients: [
                    {
                        client_id: "0000000000000000000SYNAPSE",
                        client_auth_method: "client_secret_basic",
                        client_secret: "SomeRandomSecret",
                    },
                ],
                matrix: {
                    homeserver: "localhost",
                    secret: "AnotherRandomSecret",
                    endpoint: "http://homeserver:8008",
                },
            };

            const container = await new MatrixAuthenticationServiceContainer(postgres)
                .withNetwork(network)
                .withNetworkAliases("mas")
                .withLogConsumer(logger.getConsumer("mas"))
                .withConfig(config)
                .start();

            homeserver.withConfig({
                enable_registration: undefined,
                enable_registration_without_verification: undefined,
                disable_msisdn_registration: undefined,
                password_config: undefined,
                experimental_features: {
                    msc3861: {
                        enabled: true,
                        issuer: `http://mas:8080/`,
                        introspection_endpoint: "http://mas:8080/oauth2/introspect",
                        client_id: config.clients[0].client_id,
                        client_auth_method: config.clients[0].client_auth_method,
                        client_secret: config.clients[0].client_secret,
                        admin_token: config.matrix.secret,
                    },
                },
            });

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],

    config: async ({ homeserver, context, mas }, use) => {
        const issuer = `${mas.baseUrl}/`;
        const wellKnown = {
            "m.homeserver": {
                base_url: homeserver.baseUrl,
            },
            "org.matrix.msc2965.authentication": {
                issuer,
                account: `${issuer}account`,
            },
        };

        // Ensure org.matrix.msc2965.authentication is in well-known
        await context.route("https://localhost/.well-known/matrix/client", async (route) => {
            await route.fulfill({ json: wellKnown });
        });

        await use({
            default_server_config: wellKnown,
        });
    },

    context: async ({ homeserverType, context }, use, testInfo) => {
        testInfo.skip(homeserverType !== "synapse", "does not yet support MAS");
        await use(context);
    },
};
