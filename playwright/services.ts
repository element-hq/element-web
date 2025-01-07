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
import { DendriteContainer, PineconeContainer } from "./testcontainers/dendrite.ts";
import { HomeserverType } from "./plugins/homeserver";

export interface Services {
    logger: ContainerLogger;

    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;

    mailhog: StartedTestContainer;
    mailhogClient: mailhog.API;

    _homeserver: HomeserverContainer<any>;
    homeserver: StartedHomeserverContainer;
    mas?: StartedMatrixAuthenticationServiceContainer;
}

export interface Options {
    synapseConfigOptions: SynapseConfigOptions;
    homeserverType: HomeserverType;
}

export const test = base.extend<Services & Options>({
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
    homeserverType: ["synapse", { option: true }],
    _homeserver: async ({ homeserverType, request }, use) => {
        let container: HomeserverContainer<any>;
        switch (homeserverType) {
            case "synapse":
                container = new SynapseContainer(request);
                break;
            case "dendrite":
                container = new DendriteContainer(request);
                break;
            case "pinecone":
                container = new PineconeContainer(request);
                break;
        }

        await use(container);
    },
    homeserver: async (
        { homeserverType, logger, network, _homeserver: homeserver, synapseConfigOptions, mas },
        use,
        testInfo,
    ) => {
        testInfo.skip(
            !(homeserver instanceof SynapseContainer) && Object.keys(synapseConfigOptions).length > 0,
            `Test specifies Synapse config options so is unsupported with ${homeserverType}`,
        );

        if (homeserver instanceof SynapseContainer) {
            homeserver.withConfig(synapseConfigOptions);
        }

        const container = await homeserver
            .withNetwork(network)
            .withNetworkAliases("homeserver")
            .withLogConsumer(logger.getConsumer(homeserverType))
            .start();

        await use(container);
        await container.stop();
    },
    // eslint-disable-next-line no-empty-pattern
    mas: async ({}, use) => {
        // we stub the mas fixture to allow `homeserver` to depend on it to ensure
        // when it is specified by `masHomeserver` it is started before the homeserver
        await use(undefined);
    },
});
