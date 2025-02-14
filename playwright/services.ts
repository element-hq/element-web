/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import { type MailpitClient } from "mailpit-api";
import { Network, type StartedNetwork } from "testcontainers";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { type SynapseConfig, SynapseContainer } from "./testcontainers/synapse.ts";
import { Logger } from "./logger.ts";
import { type StartedMatrixAuthenticationServiceContainer } from "./testcontainers/mas.ts";
import { type HomeserverContainer, type StartedHomeserverContainer } from "./testcontainers/HomeserverContainer.ts";
import { MailhogContainer, type StartedMailhogContainer } from "./testcontainers/mailpit.ts";
import { type OAuthServer } from "./plugins/oauth_server";
import { DendriteContainer, PineconeContainer } from "./testcontainers/dendrite.ts";
import { type HomeserverType } from "./plugins/homeserver";

export interface TestFixtures {
    mailpitClient: MailpitClient;
}

export interface Services {
    logger: Logger;

    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;
    mailpit: StartedMailhogContainer;

    synapseConfig: SynapseConfig;
    _homeserver: HomeserverContainer<any>;
    homeserver: StartedHomeserverContainer;
    // Set in masHomeserver only
    mas?: StartedMatrixAuthenticationServiceContainer;
    // Set in legacyOAuthHomeserver only
    oAuthServer?: OAuthServer;
}

export interface Options {
    homeserverType: HomeserverType;
}

export const test = base.extend<TestFixtures, Services & Options>({
    logger: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const logger = new Logger();
            await use(logger);
        },
        { scope: "worker" },
    ],
    network: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const network = await new Network().start();
            await use(network);
            await network.stop();
        },
        { scope: "worker" },
    ],
    postgres: [
        async ({ logger, network }, use) => {
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
        { scope: "worker" },
    ],

    mailpit: [
        async ({ logger, network }, use) => {
            const container = await new MailhogContainer()
                .withNetwork(network)
                .withNetworkAliases("mailpit")
                .withLogConsumer(logger.getConsumer("mailpit"))
                .start();
            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
    mailpitClient: async ({ mailpit: container }, use) => {
        await container.client.deleteMessages();
        await use(container.client);
    },

    synapseConfig: [{}, { scope: "worker" }],
    homeserverType: ["synapse", { option: true, scope: "worker" }],
    _homeserver: [
        async ({ homeserverType }, use) => {
            let container: HomeserverContainer<any>;
            switch (homeserverType) {
                case "synapse":
                    container = new SynapseContainer();
                    break;
                case "dendrite":
                    container = new DendriteContainer();
                    break;
                case "pinecone":
                    container = new PineconeContainer();
                    break;
            }

            await use(container);
        },
        { scope: "worker" },
    ],
    homeserver: [
        async ({ homeserverType, logger, network, _homeserver: homeserver, synapseConfig, mas }, use) => {
            if (homeserver instanceof SynapseContainer) {
                homeserver.withConfig(synapseConfig);
            }
            const container = await homeserver
                .withNetwork(network)
                .withNetworkAliases("homeserver")
                .withLogConsumer(logger.getConsumer(homeserverType))
                .withMatrixAuthenticationService(mas)
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
    mas: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            // we stub the mas fixture to allow `homeserver` to depend on it to ensure
            // when it is specified by `masHomeserver` it is started before the homeserver
            await use(undefined);
        },
        { scope: "worker" },
    ],

    context: async (
        { homeserverType, synapseConfig, logger, context, request, _homeserver, homeserver },
        use,
        testInfo,
    ) => {
        testInfo.skip(
            !(_homeserver instanceof SynapseContainer) && Object.keys(synapseConfig).length > 0,
            `Test specifies Synapse config options so is unsupported with ${homeserverType}`,
        );
        homeserver.setRequest(request);
        await logger.onTestStarted(context);
        await use(context);
        await logger.onTestFinished(testInfo);
        await homeserver.onTestFinished(testInfo);
    },
});
