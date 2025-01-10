/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import mailhog from "mailhog";
import { GenericContainer, Network, StartedNetwork, StartedTestContainer, Wait } from "testcontainers";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { SynapseConfigOptions, SynapseContainer } from "./testcontainers/synapse.ts";
import { ContainerLogger } from "./testcontainers/utils.ts";
import { StartedMatrixAuthenticationServiceContainer } from "./testcontainers/mas.ts";
import { HomeserverContainer, StartedHomeserverContainer } from "./testcontainers/HomeserverContainer.ts";

export interface Services {
    logger: ContainerLogger;

    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;

    mailhog: StartedTestContainer;
    mailhogClient: mailhog.API;

    synapseConfigOptions: SynapseConfigOptions;
    _homeserver: HomeserverContainer<any>;
    homeserver: StartedHomeserverContainer;
    mas?: StartedMatrixAuthenticationServiceContainer;
}

export const test = base.extend<{}, Services>({
    logger: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const logger = new ContainerLogger();
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

    mailhog: [
        async ({ logger, network }, use) => {
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
        { scope: "worker" },
    ],
    mailhogClient: [
        async ({ mailhog: container }, use) => {
            await use(mailhog({ host: container.getHost(), port: container.getMappedPort(8025) }));
        },
        { scope: "worker" },
    ],

    synapseConfigOptions: [{}, { option: true, scope: "worker" }],
    _homeserver: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const container = new SynapseContainer();
            await use(container);
        },
        { scope: "worker" },
    ],
    homeserver: [
        async ({ logger, network, _homeserver: homeserver, synapseConfigOptions, mas }, use) => {
            const container = await homeserver
                .withNetwork(network)
                .withNetworkAliases("homeserver")
                .withLogConsumer(logger.getConsumer("synapse"))
                .withConfig(synapseConfigOptions)
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

    context: async ({ logger, context, request, homeserver }, use, testInfo) => {
        homeserver.setRequest(request);
        await logger.testStarted(testInfo);
        await use(context);
        await logger.testFinished(testInfo);
        await homeserver.onTestFinished(testInfo);
    },
});
