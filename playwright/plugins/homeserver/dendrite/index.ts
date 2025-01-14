/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { DendriteContainer, PineconeContainer } from "../../../testcontainers/dendrite.ts";
import { Fixtures } from "../../../element-web-test.ts";

export const dendriteHomeserver: Fixtures = {
    _homeserver: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const container =
                process.env["PLAYWRIGHT_HOMESERVER"] === "dendrite" ? new DendriteContainer() : new PineconeContainer();
            await use(container);
        },
        { scope: "worker" },
    ],
    homeserver: [
        async ({ logger, network, _homeserver: homeserver }, use) => {
            const container = await homeserver
                .withNetwork(network)
                .withNetworkAliases("homeserver")
                .withLogConsumer(logger.getConsumer("dendrite"))
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
};

export function isDendrite(): boolean {
    return process.env["PLAYWRIGHT_HOMESERVER"] === "dendrite" || process.env["PLAYWRIGHT_HOMESERVER"] === "pinecone";
}
