/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import type { Page, Request } from "@playwright/test";
import type { Client } from "./client";

export class Network {
    private isOffline = false;
    private readonly setupPromise: Promise<void>;

    constructor(
        private page: Page,
        private client: Client,
    ) {
        this.setupPromise = this.setupRoute();
    }

    /**
     * Checks if the request is from the client associated with this network object.
     * We do this so that other clients (eg: bots) are not affected by the network change.
     */
    private async isRequestFromOurClient(request: Request): Promise<boolean> {
        const accessToken = await this.client.evaluate((client) => client.getAccessToken());
        const authHeader = await request.headerValue("Authorization");
        return authHeader === `Bearer ${accessToken}`;
    }

    private async setupRoute() {
        await this.page.route("**/_matrix/**", async (route) => {
            if (this.isOffline && (await this.isRequestFromOurClient(route.request()))) {
                route.abort();
            } else {
                route.continue();
            }
        });
    }

    // Intercept all /_matrix/ networking requests for client and fail them
    async goOffline(): Promise<void> {
        await this.setupPromise;
        this.isOffline = true;
    }

    // Remove intercept on all /_matrix/ networking requests for this client
    async goOnline(): Promise<void> {
        await this.setupPromise;
        this.isOffline = false;
    }
}
