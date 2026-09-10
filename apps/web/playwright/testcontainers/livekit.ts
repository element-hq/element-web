/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import * as YAML from "yaml";

// Pinned by digest so upstream cannot break our tests; Renovate keeps it updated (see .github/renovate.json).
const DOCKER_IMAGE =
    "livekit/livekit-server:v1.13.4@sha256:189f7c81b704a36642bc5c7e2d3e1ae83744627c11978a23a251bf19fbec64e0";

export const LIVEKIT_API_KEY = "devkey";
export const LIVEKIT_API_SECRET = "secret";

/** Signalling (HTTP + WebSocket) port inside the container; mapped to a free host port. */
const SIGNALLING_PORT = 7880;
/**
 * Media ports. Published 1:1 (same number on the host) because the SFU advertises these port numbers in its
 * ICE candidates. Deliberately not LiveKit's defaults (7881/7882) so a locally running Element Call dev
 * backend does not collide with the tests.
 */
export const LIVEKIT_TCP_PORT = 7891;
export const LIVEKIT_UDP_PORT = 7892;

/**
 * Hostname under which the SFU's signalling port is reachable from both the browser and other containers:
 * browsers resolve every `*.localhost` name to loopback (where the published port is), and containers get
 * an extra host entry pointing it at the docker host (see LiveKitJwtServiceContainer).
 */
export const LIVEKIT_HOST = "livekit.localhost";

/**
 * A LiveKit SFU testcontainer.
 *
 * Advertises `127.0.0.1` as its media address so that a browser running on the docker host can reach it
 * through the published ports, on Linux as well as on macOS.
 */
export class LiveKitContainer extends GenericContainer {
    /**
     * @param jwtServiceAlias - network alias of the lk-jwt-service container, which receives the SFU webhooks
     */
    public constructor(jwtServiceAlias: string) {
        super(DOCKER_IMAGE);

        const config = {
            port: SIGNALLING_PORT,
            bind_addresses: ["0.0.0.0"],
            rtc: {
                tcp_port: LIVEKIT_TCP_PORT,
                // A single UDP port (mux) instead of a range, so only one port has to be published.
                udp_port: LIVEKIT_UDP_PORT,
                use_external_ip: false,
                node_ip: "127.0.0.1",
            },
            keys: { [LIVEKIT_API_KEY]: LIVEKIT_API_SECRET },
            room: { auto_create: false },
            webhook: {
                api_key: LIVEKIT_API_KEY,
                urls: [`http://${jwtServiceAlias}:8080/sfu_webhook`],
            },
            logging: { level: "info" },
        };

        this.withCommand(["--config", "/etc/livekit.yaml"])
            .withCopyContentToContainer([
                {
                    target: "/etc/livekit.yaml",
                    content: YAML.stringify(config),
                },
            ])
            .withExposedPorts(
                SIGNALLING_PORT,
                { container: LIVEKIT_TCP_PORT, host: LIVEKIT_TCP_PORT },
                {
                    container: LIVEKIT_UDP_PORT,
                    host: LIVEKIT_UDP_PORT,
                    protocol: "udp",
                },
            )
            .withNetworkAliases("livekit")
            .withWaitStrategy(Wait.forHttp("/", SIGNALLING_PORT));
    }

    public override async start(): Promise<StartedLiveKitContainer> {
        return new StartedLiveKitContainer(await super.start());
    }
}

export class StartedLiveKitContainer extends AbstractStartedContainer {
    public constructor(container: StartedTestContainer) {
        super(container);
    }

    /** The WebSocket URL of the SFU, valid from the browser and (via extra host entry) from other containers. */
    public get signallingUrl(): string {
        return `ws://${LIVEKIT_HOST}:${this.getMappedPort(SIGNALLING_PORT)}`;
    }
}
