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
import { type HomeserverContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

import { type OAuthServer } from "./plugins/oauth_server";
import { DendriteContainer, PineconeContainer } from "./testcontainers/dendrite";
import { type HomeserverType } from "./plugins/homeserver";
import { SynapseContainer } from "./testcontainers/synapse";
import { startMatrixRTCBackend, type StartedMatrixRTCBackend } from "./testcontainers/matrix-rtc";

export interface Services extends BaseServices {
    // Set in legacyOAuthHomeserver only
    oAuthServer?: OAuthServer;
    /**
     * The started MatrixRTC backend (LiveKit SFU + lk-jwt-service) for the worker.
     * Only set when the `matrixRTC` option is on.
     */
    matrixRTCBackend?: StartedMatrixRTCBackend;
}

export interface WorkerOptions extends BaseWorkerOptions {
    homeserverType: HomeserverType;
    /**
     * Start a real MatrixRTC backend (LiveKit SFU + lk-jwt-service) and configure Synapse to announce it,
     * so that Element Call can hold real calls with media. Synapse only.
     */
    matrixRTC: boolean;
}

export const test = base.extend<{}, Services & WorkerOptions>({
    homeserverType: ["synapse", { option: true, scope: "worker" }],
    matrixRTC: [false, { option: true, scope: "worker" }],
    matrixRTCBackend: [
        async ({ matrixRTC, network, logger }, use) => {
            if (!matrixRTC) {
                await use(undefined);
                return;
            }
            const backend = await startMatrixRTCBackend(network, logger);
            await use(backend);
            await backend.stop();
        },
        { scope: "worker" },
    ],
    _homeserver: [
        async ({ homeserverType, matrixRTCBackend }, use) => {
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

            if (matrixRTCBackend) {
                if (!(container instanceof SynapseContainer)) {
                    throw new Error(`The matrixRTC option is only supported with Synapse, not ${homeserverType}`);
                }
                container
                    .withConfig(matrixRTCBackend.synapseConfig)
                    .withCopyFilesToContainer(matrixRTCBackend.synapseFiles);
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
