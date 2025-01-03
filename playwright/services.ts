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

export interface Services {
    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;

    mailhog: StartedTestContainer;
    mailhogClient: mailhog.API;

    synapseConfigOptions: SynapseConfigOptions;
    _homeserver: SynapseContainer;
    homeserver: StartedSynapseContainer;
    mas: StartedTestContainer;
}

// TODO logs
export const test = base.extend<Services>({
    // eslint-disable-next-line no-empty-pattern
    network: async ({}, use) => {
        const network = await new Network().start();
        await use(network);
        await network.stop();
    },
    postgres: async ({ network }, use) => {
        const container = await new PostgreSqlContainer()
            .withNetwork(network)
            .withNetworkAliases("postgres")
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

    mailhog: async ({ network }, use) => {
        const container = await new GenericContainer("mailhog/mailhog:latest")
            .withNetwork(network)
            .withNetworkAliases("mailhog")
            .withExposedPorts(8025)
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
    homeserver: async ({ mas, network, _homeserver: homeserver, synapseConfigOptions }, use) => {
        const container = await homeserver
            .withNetwork(network)
            .withNetworkAliases("homeserver")
            .withConfig(synapseConfigOptions)
            .start();

        await use(container);
        await container.stop();
    },
    mas: async ({ network }, use) => {
        const container = await new MatrixAuthenticationServiceContainer()
            .withNetwork(network)
            .withNetworkAliases("mas")
            .withConfig({
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
            })
            .start();
        await use(container);
        await container.stop();
    },
});
