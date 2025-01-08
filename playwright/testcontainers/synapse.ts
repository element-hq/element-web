/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { APIRequestContext } from "@playwright/test";
import crypto from "node:crypto";
import * as YAML from "yaml";
import { set } from "lodash";

import { getFreePort } from "../plugins/utils/port.ts";
import { randB64Bytes } from "../plugins/utils/rand.ts";
import { Credentials } from "../plugins/homeserver";
import { deepCopy } from "../plugins/utils/object.ts";
import { HomeserverContainer, StartedHomeserverContainer } from "./HomeserverContainer.ts";

const TAG = "develop@sha256:17cc0a301447430624afb860276e5c13270ddeb99a3f6d1c6d519a20b1a8f650";

const DEFAULT_CONFIG = {
    server_name: "localhost",
    public_baseurl: "", // set by start method
    pid_file: "/homeserver.pid",
    web_client: false,
    soft_file_limit: 0,
    // Needs to be configured to log to the console like a good docker process
    log_config: "/data/log.config",
    listeners: [
        {
            // Listener is always port 8008 (configured in the container)
            port: 8008,
            tls: false,
            bind_addresses: ["::"],
            type: "http",
            x_forwarded: true,
            resources: [
                {
                    names: ["client"],
                    compress: false,
                },
            ],
        },
    ],
    database: {
        // An sqlite in-memory database is fast & automatically wipes each time
        name: "sqlite3",
        args: {
            database: ":memory:",
        },
    },
    rc_messages_per_second: 10000,
    rc_message_burst_count: 10000,
    rc_registration: {
        per_second: 10000,
        burst_count: 10000,
    },
    rc_joins: {
        local: {
            per_second: 9999,
            burst_count: 9999,
        },
        remote: {
            per_second: 9999,
            burst_count: 9999,
        },
    },
    rc_joins_per_room: {
        per_second: 9999,
        burst_count: 9999,
    },
    rc_3pid_validation: {
        per_second: 1000,
        burst_count: 1000,
    },
    rc_invites: {
        per_room: {
            per_second: 1000,
            burst_count: 1000,
        },
        per_user: {
            per_second: 1000,
            burst_count: 1000,
        },
    },
    rc_login: {
        address: {
            per_second: 10000,
            burst_count: 10000,
        },
        account: {
            per_second: 10000,
            burst_count: 10000,
        },
        failed_attempts: {
            per_second: 10000,
            burst_count: 10000,
        },
    },
    media_store_path: "/tmp/media_store",
    max_upload_size: "50M",
    max_image_pixels: "32M",
    dynamic_thumbnails: false,
    enable_registration: true,
    enable_registration_without_verification: true,
    disable_msisdn_registration: false,
    registrations_require_3pid: [],
    enable_metrics: false,
    report_stats: false,
    // These placeholders will be replaced with values generated at start
    registration_shared_secret: "secret",
    macaroon_secret_key: "secret",
    form_secret: "secret",
    // Signing key must be here: it will be generated to this file
    signing_key_path: "/data/localhost.signing.key",
    trusted_key_servers: [],
    password_config: {
        enabled: true,
    },
    ui_auth: {
        session_timeout: "300s",
    },
    background_updates: {
        // Inhibit background updates as this Synapse isn't long-lived
        min_batch_size: 100000,
        sleep_duration_ms: 100000,
    },
    enable_authenticated_media: true,
    email: undefined,
    user_consent: undefined,
    server_notices: undefined,
    allow_guest_access: false,
    experimental_features: {},
    oidc_providers: [],
    serve_server_wellknown: true,
};

export type SynapseConfigOptions = Partial<typeof DEFAULT_CONFIG>;

export class SynapseContainer extends GenericContainer implements HomeserverContainer<typeof DEFAULT_CONFIG> {
    private config: typeof DEFAULT_CONFIG;

    constructor(private readonly request: APIRequestContext) {
        super(`ghcr.io/element-hq/synapse:${TAG}`);

        this.config = deepCopy(DEFAULT_CONFIG);
        this.config.registration_shared_secret = randB64Bytes(16);
        this.config.macaroon_secret_key = randB64Bytes(16);
        this.config.form_secret = randB64Bytes(16);

        const signingKey = randB64Bytes(32);
        this.withWaitStrategy(Wait.forHttp("/health", 8008)).withCopyContentToContainer([
            { target: this.config.signing_key_path, content: `ed25519 x ${signingKey}` },
            {
                target: this.config.log_config,
                content: YAML.stringify({
                    version: 1,
                    formatters: {
                        precise: {
                            format: "%(asctime)s - %(name)s - %(lineno)d - %(levelname)s - %(request)s - %(message)s",
                        },
                    },
                    handlers: {
                        console: {
                            class: "logging.StreamHandler",
                            formatter: "precise",
                        },
                    },
                    loggers: {
                        "synapse.storage.SQL": {
                            level: "DEBUG",
                        },
                        "twisted": {
                            handlers: ["console"],
                            propagate: false,
                        },
                    },
                    root: {
                        level: "DEBUG",
                        handlers: ["console"],
                    },
                    disable_existing_loggers: false,
                }),
            },
        ]);
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

    public override async start(): Promise<StartedSynapseContainer> {
        // Synapse config public_baseurl needs to know what URL it'll be accessed from, so we have to map the port manually
        const port = await getFreePort();

        this.withExposedPorts({
            container: 8008,
            host: port,
        })
            .withConfig({
                public_baseurl: `http://localhost:${port}`,
            })
            .withCopyContentToContainer([
                {
                    target: "/data/homeserver.yaml",
                    content: YAML.stringify(this.config),
                },
            ]);

        return new StartedSynapseContainer(
            await super.start(),
            `http://localhost:${port}`,
            this.config.registration_shared_secret,
            this.request,
        );
    }
}

export class StartedSynapseContainer extends AbstractStartedContainer implements StartedHomeserverContainer {
    private adminToken?: string;

    constructor(
        container: StartedTestContainer,
        public readonly baseUrl: string,
        private readonly registrationSharedSecret: string,
        private readonly request: APIRequestContext,
    ) {
        super(container);
    }

    private async registerUserInternal(
        username: string,
        password: string,
        displayName?: string,
        admin = false,
    ): Promise<Credentials> {
        const url = `${this.baseUrl}/_synapse/admin/v1/register`;
        const { nonce } = await this.request.get(url).then((r) => r.json());
        const mac = crypto
            .createHmac("sha1", this.registrationSharedSecret)
            .update(`${nonce}\0${username}\0${password}\0${admin ? "" : "not"}admin`)
            .digest("hex");
        const res = await this.request.post(url, {
            data: {
                nonce,
                username,
                password,
                mac,
                admin,
                displayname: displayName,
            },
        });

        if (!res.ok()) {
            throw await res.json();
        }

        const data = await res.json();
        return {
            homeServer: data.home_server,
            accessToken: data.access_token,
            userId: data.user_id,
            deviceId: data.device_id,
            password,
            displayName,
        };
    }

    public registerUser(username: string, password: string, displayName?: string): Promise<Credentials> {
        return this.registerUserInternal(username, password, displayName, false);
    }

    public async loginUser(userId: string, password: string): Promise<Credentials> {
        const url = `${this.baseUrl}/_matrix/client/v3/login`;
        const res = await this.request.post(url, {
            data: {
                type: "m.login.password",
                identifier: {
                    type: "m.id.user",
                    user: userId,
                },
                password: password,
            },
        });
        const json = await res.json();

        return {
            password,
            accessToken: json.access_token,
            userId: json.user_id,
            deviceId: json.device_id,
            homeServer: json.home_server,
        };
    }

    public async setThreepid(userId: string, medium: string, address: string): Promise<void> {
        if (this.adminToken === undefined) {
            const result = await this.registerUserInternal("admin", "totalyinsecureadminpassword", undefined, true);
            this.adminToken = result.accessToken;
        }

        const url = `${this.baseUrl}/_synapse/admin/v2/users/${userId}`;
        const res = await this.request.put(url, {
            data: {
                threepids: [
                    {
                        medium,
                        address,
                    },
                ],
            },
            headers: {
                Authorization: `Bearer ${this.adminToken}`,
            },
        });

        if (!res.ok()) {
            throw await res.json();
        }
    }
}
