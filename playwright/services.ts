/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import mailhog from "mailhog";
import { GenericContainer, Network, StartedNetwork, StartedTestContainer, Wait } from "testcontainers";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { StartedSynapseContainer, SynapseConfigOptions, SynapseContainer } from "./testcontainers/synapse.ts";
import { MatrixAuthenticationServiceContainer } from "./testcontainers/mas.ts";
import { ContainerLogger } from "./testcontainers/utils.ts";

export interface Services {
    logger: ContainerLogger;

    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;

    mailhog: StartedTestContainer;
    mailhogClient: mailhog.API;

    synapseConfigOptions: SynapseConfigOptions;
    _homeserver: SynapseContainer;
    homeserver: StartedSynapseContainer;
    mas: StartedTestContainer;
}

export const test = base.extend<Services>({
    // eslint-disable-next-line no-empty-pattern
    logger: async ({}, use, testInfo) => {
        const logger = new ContainerLogger();
        await use(logger);
        await logger.testFinished(testInfo);
    },
    // eslint-disable-next-line no-empty-pattern
    network: async ({}, use) => {
        const network = await new Network().start();
        await use(network);
        await network.stop();
    },
    postgres: async ({ logger, network }, use) => {
        const container = await new PostgreSqlContainer()
            .withNetwork(network)
            .withNetworkAliases("postgres")
            .withLogConsumer(logger.getConsumer("postgres"))
            .withTmpFs({
                "/dev/shm/pgdata/data": "",
            })
            .withEnvironment({
                PG_DATA: "/dev/shm/pgdata/data",
            })
            .withCommand([
                "-c",
                "shared_buffers=128MB",
                "-c",
                `fsync=off`,
                "-c",
                `synchronous_commit=off`,
                "-c",
                "full_page_writes=off",
            ])
            .start();
        await use(container);
        await container.stop();
    },

    mailhog: async ({ logger, network }, use) => {
        const container = await new GenericContainer("mailhog/mailhog:latest")
            .withNetwork(network)
            .withNetworkAliases("mailhog")
            .withExposedPorts(8025)
            .withLogConsumer(logger.getConsumer("mailhog"))
            .withWaitStrategy(Wait.forListeningPorts())
            .start();
        await use(container);
        await container.stop();
    },
    mailhogClient: async ({ mailhog: container }, use) => {
        await use(mailhog({ host: container.getHost(), port: container.getMappedPort(8025) }));
    },

    synapseConfigOptions: [{}, { option: true }],
    _homeserver: async ({ request }, use) => {
        const container = new SynapseContainer(request);
        await use(container);
    },
    homeserver: async ({ logger, network, _homeserver: homeserver, synapseConfigOptions }, use) => {
        const container = await homeserver
            .withNetwork(network)
            .withNetworkAliases("homeserver")
            .withLogConsumer(logger.getConsumer("synapse"))
            .withConfig(synapseConfigOptions)
            .start();

        await use(container);
        await container.stop();
    },
    mas: async ({ _homeserver: homeserver, logger, network, postgres, mailhog }, use) => {
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
                endpoint: "http://synapse:8008",
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
            experimental_features: {
                msc3861: {
                    enabled: true,
                    issuer: "http://mas:8080/",
                    issuer_metadata: {
                        "issuer": `http://${container.getHost()}:${container.getMappedPort(8080)}/`,
                        "authorization_endpoint": "http://mas:8080/authorize",
                        "token_endpoint": "http://mas:8080/oauth2/token",
                        "jwks_uri": "http://mas:8080/oauth2/keys.json",
                        "registration_endpoint": "http://mas:8080/oauth2/registration",
                        "scopes_supported": ["openid", "email"],
                        "response_types_supported": ["code", "id_token", "code id_token"],
                        "response_modes_supported": ["form_post", "query", "fragment"],
                        "grant_types_supported": [
                            "authorization_code",
                            "refresh_token",
                            "client_credentials",
                            "urn:ietf:params:oauth:grant-type:device_code",
                        ],
                        "token_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "token_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "revocation_endpoint": "http://mas:8080/oauth2/revoke",
                        "revocation_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "revocation_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "introspection_endpoint": "http://mas:8080/oauth2/introspect",
                        "introspection_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "introspection_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "code_challenge_methods_supported": ["plain", "S256"],
                        "userinfo_endpoint": "http://mas:8080/oauth2/userinfo",
                        "subject_types_supported": ["public"],
                        "id_token_signing_alg_values_supported": [
                            "RS256",
                            "RS384",
                            "RS512",
                            "ES256",
                            "ES384",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256K",
                        ],
                        "userinfo_signing_alg_values_supported": [
                            "RS256",
                            "RS384",
                            "RS512",
                            "ES256",
                            "ES384",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256K",
                        ],
                        "display_values_supported": ["page"],
                        "claim_types_supported": ["normal"],
                        "claims_supported": [
                            "iss",
                            "sub",
                            "aud",
                            "iat",
                            "exp",
                            "nonce",
                            "auth_time",
                            "at_hash",
                            "c_hash",
                        ],
                        "claims_parameter_supported": false,
                        "request_parameter_supported": false,
                        "request_uri_parameter_supported": false,
                        "prompt_values_supported": ["none", "login", "create"],
                        "device_authorization_endpoint": "http://mas:8080/oauth2/device",
                        "org.matrix.matrix-authentication-service.graphql_endpoint": "http://mas:8080/graphql",
                        "account_management_uri": "http://mas:8080/account/",
                        "account_management_actions_supported": [
                            "org.matrix.profile",
                            "org.matrix.sessions_list",
                            "org.matrix.session_view",
                            "org.matrix.session_end",
                        ],
                    },
                    client_id: config.clients[0].client_id,
                    client_auth_method: config.clients[0].client_auth_method,
                    client_secret: config.clients[0].client_secret,
                    admin_token: config.matrix.secret,
                    account_management_url: `http://${container.getHost()}:${container.getMappedPort(8080)}/account`,
                },
            },
        });

        await use(container);
        await container.stop();
    },
});
