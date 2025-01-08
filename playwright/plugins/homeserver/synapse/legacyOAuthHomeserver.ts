/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Fixtures } from "@playwright/test";
import { TestContainers } from "testcontainers";

import { Services } from "../../../services.ts";
import { OAuthServer } from "../../oauth_server";

export const legacyOAuthHomeserver: Fixtures<{}, Services> = {
    _homeserver: [
        async ({ _homeserver: container }, use) => {
            const server = new OAuthServer();
            const port = server.start();

            await TestContainers.exposeHostPorts(port);
            container.withConfig({
                oidc_providers: [
                    {
                        idp_id: "test",
                        idp_name: "OAuth test",
                        issuer: `http://localhost:${port}/oauth`,
                        authorization_endpoint: `http://localhost:${port}/oauth/auth.html`,
                        // the token endpoint receives requests from synapse,
                        // rather than the webapp, so needs to escape the docker container.
                        token_endpoint: `http://host.testcontainers.internal:${port}/oauth/token`,
                        userinfo_endpoint: `http://host.testcontainers.internal:${port}/oauth/userinfo`,
                        client_id: "synapse",
                        discover: false,
                        scopes: ["profile"],
                        skip_verification: true,
                        client_auth_method: "none",
                        user_mapping_provider: {
                            config: {
                                display_name_template: "{{ user.name }}",
                            },
                        },
                    },
                ],
            });
            await use(container);
            server.stop();
        },
        { scope: "worker" },
    ],
};
