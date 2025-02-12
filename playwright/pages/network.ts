/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page, Request, Route } from "@playwright/test";
import type { Client } from "./client";

/**
 * Utility class to simulate offline mode by blocking all requests to the homeserver.
 * Will not affect any requests before `setupRoute` is called,
 * which happens implicitly using the goOffline/goOnline methods.
 */
export class Network {
    private isOffline = false;
    private setupPromise?: Promise<void>;

    constructor(
        private page: Page,
        private client: Client,
    ) {}

    /**
     * Checks if the request is from the client associated with this network object.
     * We do this so that other clients (eg: bots) are not affected by the network change.
     */
    private async isRequestFromOurClient(request: Request): Promise<boolean> {
        const accessToken = await this.client.evaluate((client) => client.getAccessToken());
        const authHeader = await request.headerValue("Authorization");
        return authHeader === `Bearer ${accessToken}`;
    }

    private handler = async (route: Route) => {
        if (this.isOffline && (await this.isRequestFromOurClient(route.request()))) {
            await route.abort();
        } else {
            await route.continue();
        }
    };

    /**
     * Intercept all /_matrix/ networking requests for client ready to continue/abort them based on offline status
     * which is set by the goOffline/goOnline methods
     */
    public async setupRoute() {
        if (!this.setupPromise) {
            this.setupPromise = this.page.route("**/_matrix/**", this.handler);
        }
        await this.setupPromise;
    }

    /**
     * Cease intercepting all /_matrix/ networking requests for client
     */
    public async destroyRoute() {
        if (!this.setupPromise) return;
        await this.page.unroute("**/_matrix/**", this.handler);
        this.setupPromise = undefined;
    }

    /**
     * Reject all /_matrix/ networking requests for client
     */
    async goOffline(): Promise<void> {
        await this.setupRoute();
        this.isOffline = true;
    }

    /**
     * Continue all /_matrix/ networking requests for this client
     */
    async goOnline(): Promise<void> {
        await this.setupRoute();
        this.isOffline = false;
    }
}
