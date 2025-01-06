/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Fixtures, PlaywrightTestArgs } from "@playwright/test";

import { Fixtures as BaseFixtures } from "../../../element-web-test.ts";
import { DendriteContainer, PineconeContainer } from "../../../testcontainers/dendrite.ts";
import { Services } from "../../../services.ts";

type Fixture = PlaywrightTestArgs & Services & BaseFixtures;
export const dendriteHomeserver: Fixtures<Fixture, {}, Fixture> = {
    _homeserver: async ({ request }, use) => {
        const container =
            process.env["PLAYWRIGHT_HOMESERVER"] === "dendrite"
                ? new DendriteContainer(request)
                : new PineconeContainer(request);
        await use(container);
    },
    homeserver: async ({ logger, network, _homeserver: homeserver }, use) => {
        const container = await homeserver
            .withNetwork(network)
            .withNetworkAliases("homeserver")
            .withLogConsumer(logger.getConsumer("dendrite"))
            .start();

        await use(container);
        await container.stop();
    },
};

export function isDendrite(): boolean {
    return process.env["PLAYWRIGHT_HOMESERVER"] === "dendrite" || process.env["PLAYWRIGHT_HOMESERVER"] === "pinecone";
}
