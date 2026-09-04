/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST } from "./livekit";

// Pinned by digest so upstream cannot break our tests; Renovate keeps it updated (see .github/renovate.json).
const DOCKER_IMAGE =
    "ghcr.io/element-hq/lk-jwt-service:0.6.0@sha256:822f0c03a3bdd924da92afc2e8ec59de5dda17af42d32e71e11f269c3517abf7";

const PORT = 8080;

export interface LiveKitJwtServiceOptions {
    /** WebSocket URL of the SFU, handed out to clients and used by the service itself. */
    livekitUrl: string;
    /** The homeserver's `server_name`; also its network alias so the federation API resolves to it. */
    homeserverServerName: string;
    /** Client-Server API base URL of the homeserver as reachable from inside the docker network. */
    homeserverInternalUrl: string;
}

/**
 * A MatrixRTC authorisation service (lk-jwt-service) testcontainer.
 *
 * The service validates OpenID tokens over the homeserver's federation API, which is HTTPS-only, so the
 * homeserver needs a TLS federation listener; certificate verification is switched off here.
 */
export class LiveKitJwtServiceContainer extends GenericContainer {
    public constructor(opts: LiveKitJwtServiceOptions) {
        super(DOCKER_IMAGE);

        this.withEnvironment({
            LIVEKIT_URL: opts.livekitUrl,
            LIVEKIT_KEY: LIVEKIT_API_KEY,
            LIVEKIT_SECRET: LIVEKIT_API_SECRET,
            LIVEKIT_FULL_ACCESS_HOMESERVERS: "*",
            LIVEKIT_INSECURE_SKIP_VERIFY_TLS: "YES_I_KNOW_WHAT_I_AM_DOING",
            // Used for delayed-leave delegation calls; skips .well-known discovery for our server name.
            LIVEKIT_CS_API_URL_OVERRIDES: `${opts.homeserverServerName}=${opts.homeserverInternalUrl}`,
        })
            // Makes the browser-facing SFU hostname resolve to the docker host from inside this container too.
            .withExtraHosts([{ host: LIVEKIT_HOST, ipAddress: "host-gateway" }])
            .withExposedPorts(PORT)
            .withNetworkAliases("lk-jwt-service")
            .withWaitStrategy(Wait.forHttp("/healthz", PORT));
    }

    public override async start(): Promise<StartedLiveKitJwtServiceContainer> {
        return new StartedLiveKitJwtServiceContainer(await super.start());
    }
}

export class StartedLiveKitJwtServiceContainer extends AbstractStartedContainer {
    public constructor(container: StartedTestContainer) {
        super(container);
    }

    /** Base URL of the service as reachable from the browser (`livekit_service_url`). */
    public get baseUrl(): string {
        return `http://localhost:${this.getMappedPort(PORT)}`;
    }
}
