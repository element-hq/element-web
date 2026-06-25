/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    StartedSynapseContainer,
    SynapseContainer,
} from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";
import { Readable } from "node:stream";
import { GenericContainer, Wait } from "testcontainers";

// We use the SynapseContainer as a base to have all of its utilities for config setting
export class RestrictedGuestsSynapseContainer extends SynapseContainer {
    protected getModuleConfig(): Record<string, unknown> {
        return {};
    }

    public override async start(): Promise<StartedSynapseContainer> {
        // Download the synapse module
        const initContainer = await new GenericContainer("ghcr.io/element-hq/synapse-guest-module:861f7ee")
            .withWaitStrategy(Wait.forOneShotStartup())
            .start();
        const tarStream = await initContainer.copyArchiveFromContainer(`/src/synapse_guest_module`);
        await initContainer.stop();

        this.withCopyArchivesToContainer([
            {
                tar: Readable.from(tarStream),
                target: "/",
            },
        ]).withEnvironment({
            PYTHONPATH: "/modules",
        });

        this.config.modules.push({
            module: "synapse_guest_module.GuestModule",
            config: this.getModuleConfig(),
        });

        return super.start();
    }
}

interface RestrictedGuestsMasModuleConfig {
    adminApiBaseUrl: string;
    oauthBaseUrl?: string;
    clientId: string;
    clientSecret: string;
}

export class RestrictedGuestsSynapseWithMasContainer extends RestrictedGuestsSynapseContainer {
    public constructor(private readonly masConfig: RestrictedGuestsMasModuleConfig) {
        super();
    }

    protected override getModuleConfig(): Record<string, unknown> {
        return {
            mas: {
                admin_api_base_url: this.masConfig.adminApiBaseUrl,
                oauth_base_url: this.masConfig.oauthBaseUrl ?? this.masConfig.adminApiBaseUrl,
                client_id: this.masConfig.clientId,
                client_secret: this.masConfig.clientSecret,
            },
        };
    }
}
