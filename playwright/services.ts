/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@element-hq/element-web-playwright-common";
import {
    type Services as BaseServices,
    type WorkerOptions as BaseWorkerOptions,
} from "@element-hq/element-web-playwright-common/lib/fixtures";
import { type HomeserverContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

import { type OAuthServer } from "./plugins/oauth_server";
import { DendriteContainer, PineconeContainer } from "./testcontainers/dendrite";
import { type HomeserverType } from "./plugins/homeserver";
import { SynapseContainer } from "./testcontainers/synapse";

export interface Services extends BaseServices {
    // Set in legacyOAuthHomeserver only
    oAuthServer?: OAuthServer;
}

export interface WorkerOptions extends BaseWorkerOptions {
    homeserverType: HomeserverType;
}

export const test = base.extend<{}, Services & WorkerOptions>({
    homeserverType: ["synapse", { option: true, scope: "worker" }],
    _homeserver: [
        async ({ homeserverType }, use) => {
            let container: HomeserverContainer<unknown>;
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

    context: async ({ homeserverType, synapseConfig, context, _homeserver }, use, testInfo) => {
        testInfo.skip(
            !(_homeserver instanceof SynapseContainer) && Object.keys(synapseConfig).length > 0,
            `Test specifies Synapse config options so is unsupported with ${homeserverType}`,
        );
        await use(context);
    },
});
