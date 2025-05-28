/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import { type MailpitClient } from "mailpit-api";
import { Network, type StartedNetwork } from "testcontainers";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import {
    type SynapseConfig,
    SynapseContainer,
    type StartedMatrixAuthenticationServiceContainer,
    type HomeserverContainer,
    type StartedHomeserverContainer,
    MailpitContainer,
    type StartedMailpitContainer,
} from "../testcontainers/index.js";
import { Logger } from "../utils/logger.js";

/**
 * Test-scoped fixtures available in the test
 */
export interface TestFixtures {
    /**
     * The mailpit client instance for the test.
     * This is a fresh client instance with no messages from prior tests.
     */
    mailpitClient: MailpitClient;
}

export interface WorkerOptions {
    /**
     * The synapse configuration to use for the homeserver.
     */
    synapseConfig: Partial<SynapseConfig>;
}

/**
 * Worker-scoped "service" fixtures available in the test
 */
export interface Services {
    /**
     * The logger instance for the worker.
     */
    logger: Logger;

    /**
     * The started testcontainers network instance for the worker.
     */
    network: StartedNetwork;

    /**
     * The started postgres container instance for the worker.
     */
    postgres: StartedPostgreSqlContainer;

    /**
     * The started mailpit container instance for the worker.
     */
    mailpit: StartedMailpitContainer;

    /**
     * The homeserver instance container to use for the worker.
     */
    _homeserver: HomeserverContainer<unknown>;
    /**
     * The started homeserver instance container for the worker.
     */
    homeserver: StartedHomeserverContainer;

    /**
     * The Matrix Authentication Service container instance for the worker.
     * May be undefined if no delegated auth is in use.
     */
    mas?: StartedMatrixAuthenticationServiceContainer;
}

export const test = base.extend<TestFixtures, WorkerOptions & Services>({
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
            const container = await new PostgreSqlContainer("postgres:13.3-alpine")
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
            const container = await new MailpitContainer()
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
    _homeserver: [
        async ({ logger }, use) => {
            const container = new SynapseContainer().withLogConsumer(logger.getConsumer("synapse"));
            await use(container);
        },
        { scope: "worker" },
    ],
    homeserver: [
        async ({ logger, network, _homeserver: homeserver, synapseConfig, mas }, use) => {
            if (homeserver instanceof SynapseContainer) {
                homeserver.withConfig(synapseConfig);
            }
            const container = await homeserver
                .withNetwork(network)
                .withNetworkAliases("homeserver")
                .withLogConsumer(logger.getConsumer("homeserver"))
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

    context: async ({ logger, context, request, homeserver }, use, testInfo) => {
        homeserver.setRequest(request);
        await logger.onTestStarted(context);
        await use(context);
        await logger.onTestFinished(testInfo);
        await homeserver.onTestFinished(testInfo);
    },
});
