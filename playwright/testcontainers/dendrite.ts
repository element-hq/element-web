/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { GenericContainer, Wait } from "testcontainers";
import * as YAML from "yaml";
import { set } from "lodash";

import { randB64Bytes } from "../plugins/utils/rand.ts";
import { StartedSynapseContainer } from "./synapse.ts";
import { deepCopy } from "../plugins/utils/object.ts";
import { type HomeserverContainer } from "./HomeserverContainer.ts";
import { type StartedMatrixAuthenticationServiceContainer } from "./mas.ts";

const DEFAULT_CONFIG = {
    version: 2,
    global: {
        server_name: "localhost",
        private_key: "matrix_key.pem",
        old_private_keys: null,
        key_validity_period: "168h0m0s",
        cache: {
            max_size_estimated: "1gb",
            max_age: "1h",
        },
        well_known_server_name: "",
        well_known_client_name: "",
        trusted_third_party_id_servers: ["matrix.org", "vector.im"],
        disable_federation: false,
        presence: {
            enable_inbound: false,
            enable_outbound: false,
        },
        report_stats: {
            enabled: false,
            endpoint: "https://matrix.org/report-usage-stats/push",
        },
        server_notices: {
            enabled: false,
            local_part: "_server",
            display_name: "Server Alerts",
            avatar_url: "",
            room_name: "Server Alerts",
        },
        jetstream: {
            addresses: null,
            disable_tls_validation: false,
            storage_path: "./",
            topic_prefix: "Dendrite",
        },
        metrics: {
            enabled: false,
            basic_auth: {
                username: "metrics",
                password: "metrics",
            },
        },
        dns_cache: {
            enabled: false,
            cache_size: 256,
            cache_lifetime: "5m",
        },
    },
    app_service_api: {
        disable_tls_validation: false,
        config_files: null,
    },
    client_api: {
        registration_disabled: false,
        guests_disabled: true,
        registration_shared_secret: "secret",
        enable_registration_captcha: false,
        recaptcha_public_key: "",
        recaptcha_private_key: "",
        recaptcha_bypass_secret: "",
        turn: {
            turn_user_lifetime: "5m",
            turn_uris: null,
            turn_shared_secret: "",
        },
        rate_limiting: {
            enabled: true,
            threshold: 20,
            cooloff_ms: 500,
            exempt_user_ids: null,
        },
    },
    federation_api: {
        send_max_retries: 16,
        disable_tls_validation: false,
        disable_http_keepalives: false,
        key_perspectives: [
            {
                server_name: "matrix.org",
                keys: [
                    {
                        key_id: "ed25519:auto",
                        public_key: "Noi6WqcDj0QmPxCNQqgezwTlBKrfqehY1u2FyWP9uYw",
                    },
                    {
                        key_id: "ed25519:a_RXGa",
                        public_key: "l8Hft5qXKn1vfHrg3p4+W8gELQVo8N13JkluMfmn2sQ",
                    },
                ],
            },
        ],
        prefer_direct_fetch: false,
        database: {
            connection_string: "file:dendrite-federationapi.db",
        },
    },
    media_api: {
        base_path: "./media_store",
        max_file_size_bytes: 10485760,
        dynamic_thumbnails: false,
        max_thumbnail_generators: 10,
        thumbnail_sizes: [
            {
                width: 32,
                height: 32,
                method: "crop",
            },
            {
                width: 96,
                height: 96,
                method: "crop",
            },
            {
                width: 640,
                height: 480,
                method: "scale",
            },
        ],
        database: {
            connection_string: "file:dendrite-mediaapi.db",
        },
    },
    mscs: {
        mscs: null,
        database: {
            connection_string: "file:dendrite-msc.db",
        },
    },
    sync_api: {
        search: {
            enabled: false,
            index_path: "./searchindex",
            language: "en",
        },
        database: {
            connection_string: "file:dendrite-syncapi.db",
        },
    },
    user_api: {
        bcrypt_cost: 10,
        auto_join_rooms: null,
        account_database: {
            connection_string: "file:dendrite-userapi.db",
        },
    },
    room_server: {
        database: {
            connection_string: "file:dendrite-roomserverapi.db",
        },
    },
    key_server: {
        database: {
            connection_string: "file:dendrite-keyserverapi.db",
        },
    },
    relay_api: {
        database: {
            connection_string: "file:dendrite-relayapi.db",
        },
    },
    tracing: {
        enabled: false,
        jaeger: {
            serviceName: "",
            disabled: false,
            rpc_metrics: false,
            tags: [],
            sampler: null,
            reporter: null,
            headers: null,
            baggage_restrictions: null,
            throttler: null,
        },
    },
    logging: [
        {
            type: "std",
            level: "debug",
        },
        {
            type: "file",
            level: "debug",
            params: {
                path: "./logs",
            },
        },
    ],
};

export class DendriteContainer extends GenericContainer implements HomeserverContainer<typeof DEFAULT_CONFIG> {
    private config: typeof DEFAULT_CONFIG;

    constructor(image = "matrixdotorg/dendrite-monolith:main", binary = "/usr/bin/dendrite") {
        super(image);

        this.config = deepCopy(DEFAULT_CONFIG);
        this.config.client_api.registration_shared_secret = randB64Bytes(16);

        this.withEntrypoint(["/bin/sh"])
            .withCommand([
                "-c",
                `/usr/bin/generate-keys -private-key /etc/dendrite/matrix_key.pem && ${binary} --config /etc/dendrite/dendrite.yaml --really-enable-open-registration true run`,
            ])
            .withExposedPorts(8008)
            .withWaitStrategy(Wait.forHttp("/_matrix/client/versions", 8008));
    }

    public withConfigField(key: string, value: any): this {
        set(this.config, key, value);
        return this;
    }

    public withConfig(config: Partial<typeof DEFAULT_CONFIG>): this {
        this.config = {
            ...this.config,
            ...config,
        };
        return this;
    }

    // Dendrite does not support MAS at this time
    public withMatrixAuthenticationService(mas?: StartedMatrixAuthenticationServiceContainer): this {
        return this;
    }

    public override async start(): Promise<StartedDendriteContainer> {
        this.withCopyContentToContainer([
            {
                target: "/etc/dendrite/dendrite.yaml",
                content: YAML.stringify(this.config),
            },
        ]);

        const container = await super.start();
        return new StartedDendriteContainer(
            container,
            `http://${container.getHost()}:${container.getMappedPort(8008)}`,
            this.config.client_api.registration_shared_secret,
        );
    }
}

export class PineconeContainer extends DendriteContainer {
    constructor() {
        super("matrixdotorg/dendrite-demo-pinecone:main", "/usr/bin/dendrite-demo-pinecone");
    }
}

// Surprisingly, Dendrite implements the same register user Synapse Admin API, so we can just extend it
export class StartedDendriteContainer extends StartedSynapseContainer {
    protected async deletePublicRooms(): Promise<void> {
        // Dendrite does not support admin users managing the room directory
        // https://github.com/element-hq/dendrite/blob/main/clientapi/routing/directory.go#L365
        return;
    }
}
