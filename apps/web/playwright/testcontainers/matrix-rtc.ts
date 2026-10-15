/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { fileURLToPath } from "node:url";
import { type GenericContainer, type StartedNetwork } from "testcontainers";
import { type SynapseConfig } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";
import { type Logger } from "@element-hq/element-web-playwright-common/lib/utils/logger.js";

import { LiveKitContainer, type StartedLiveKitContainer } from "./livekit";
import { LiveKitJwtServiceContainer, type StartedLiveKitJwtServiceContainer } from "./lk-jwt-service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type FileToCopy = Parameters<GenericContainer["withCopyFilesToContainer"]>[0][number];

/**
 * The homeserver's `server_name`. It has to equal the network alias the `homeserver` fixture gives the
 * Synapse container, because lk-jwt-service resolves the federation API as `https://<server_name>:8448`.
 */
export const MATRIX_RTC_SERVER_NAME = "homeserver";

export interface StartedMatrixRTCBackend {
    livekit: StartedLiveKitContainer;
    jwtService: StartedLiveKitJwtServiceContainer;
    /** Synapse configuration to merge in so clients discover the backend via `/rtc/transports`. */
    synapseConfig: Partial<SynapseConfig>;
    /** Self-signed certificate for Synapse's TLS federation listener. */
    synapseFiles: FileToCopy[];
    stop(): Promise<void>;
}

/**
 * Starts a MatrixRTC backend (LiveKit SFU + lk-jwt-service) on the given network and returns the Synapse
 * configuration that wires a homeserver up to it: a TLS federation listener the jwt service can validate
 * OpenID tokens against, the MSCs Element Call relies on, and the transport announcement.
 */
export async function startMatrixRTCBackend(network: StartedNetwork, logger: Logger): Promise<StartedMatrixRTCBackend> {
    const livekit = await new LiveKitContainer("lk-jwt-service")
        .withNetwork(network)
        .withLogConsumer(logger.getConsumer("livekit"))
        .start();

    const jwtService = await new LiveKitJwtServiceContainer({
        livekitUrl: livekit.signallingUrl,
        homeserverServerName: MATRIX_RTC_SERVER_NAME,
        homeserverInternalUrl: `http://${MATRIX_RTC_SERVER_NAME}:8008`,
    })
        .withNetwork(network)
        .withLogConsumer(logger.getConsumer("lk-jwt-service"))
        .start();

    // `withConfig` merges shallowly, so top-level keys are given in full.
    const synapseConfig = {
        server_name: MATRIX_RTC_SERVER_NAME,
        listeners: [
            {
                port: 8008,
                tls: false,
                bind_addresses: ["::"],
                type: "http",
                x_forwarded: true,
                resources: [{ names: ["client"], compress: false }],
            },
            {
                port: 8448,
                tls: true,
                bind_addresses: ["0.0.0.0"],
                type: "http",
                x_forwarded: false,
                resources: [{ names: ["federation"], compress: false }],
            },
        ],
        tls_certificate_path: "/data/tls.crt",
        tls_private_key_path: "/data/tls.key",
        experimental_features: {
            // MSC4143: `/rtc/transports` announcement
            msc4143_enabled: true,
            // MSC3266: room summary API
            msc3266_enabled: true,
            // MSC4222: `state_after` in sync
            msc4222_enabled: true,
            // MSC4354: sticky events for MatrixRTC memberships
            msc4354_enabled: true,
        },
        // MSC4140 delayed events, used for the delayed leave event
        max_event_delay_duration: "24h",
        rc_delayed_event_mgmt: { per_second: 10000, burst_count: 10000 },
        matrix_rtc: {
            transports: [{ type: "livekit", livekit_service_url: jwtService.baseUrl }],
        },
    } as Partial<SynapseConfig>;

    const synapseFiles: FileToCopy[] = [
        {
            source: path.join(__dirname, "res", "matrix-rtc", "tls.crt"),
            target: "/data/tls.crt",
        },
        {
            source: path.join(__dirname, "res", "matrix-rtc", "tls.key"),
            target: "/data/tls.key",
        },
    ];

    return {
        livekit,
        jwtService,
        synapseConfig,
        synapseFiles,
        stop: async () => {
            await jwtService.stop();
            await livekit.stop();
        },
    };
}
