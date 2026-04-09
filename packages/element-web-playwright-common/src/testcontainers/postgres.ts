/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { type StartedNetwork } from "testcontainers";

import { type Logger } from "../utils/logger.js";

export async function makePostgres(
    network: StartedNetwork,
    logger: Logger,
    name = "postgres",
): Promise<StartedPostgreSqlContainer> {
    const container = await new PostgreSqlContainer("postgres:13.3-alpine")
        .withNetwork(network)
        .withNetworkAliases(name)
        .withLogConsumer(logger.getConsumer(name))
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
    return container;
}
