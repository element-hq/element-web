/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    AbstractStartedContainer,
    GenericContainer,
    type RestartOptions,
    type StartedTestContainer,
    Wait,
} from "testcontainers";
import { type APIRequestContext, type TestInfo } from "@playwright/test";
import crypto from "node:crypto";
import * as YAML from "yaml";
import { set } from "lodash-es";

import { getFreePort } from "../utils/port.js";
import { randB64Bytes } from "../utils/rand.js";
import { deepCopy } from "../utils/object.js";
import { type HomeserverContainer, type StartedHomeserverContainer } from "./HomeserverContainer.js";
import { type StartedMatrixAuthenticationServiceContainer } from "./mas.js";
import { Api, ClientServerApi, type Verb, type Credentials } from "../utils/api.js";
import { StartedMailpitContainer } from "./mailpit.js";

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
    rc_room_creation: {
        per_second: 1000,
        burst_count: 1000,
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
    ui_auth: {},
    background_updates: {
        // Inhibit background updates as this Synapse isn't long-lived
        min_batch_size: 100000,
        sleep_duration_ms: 100000,
    },
    enable_authenticated_media: true,
    email: undefined as
        | undefined
        | {
              enable_notifs: boolean;
              smtp_host: string;
              smtp_port: number;
              smtp_user: string;
              smtp_pass: string;
              require_transport_security: false;
              notif_from: string;
              app_name: string;
              notif_template_html: string;
              notif_template_text: string;
              notif_for_new_users: boolean;
              client_base_url: string;
          },
    user_consent: undefined as
        | undefined
        | {
              template_dir: string;
              version: string;
              server_notice_content: Record<string, unknown>;
              send_server_notice_to_guests: boolean;
              block_events_error: string;
              require_at_registration: boolean;
          },
    server_notices: undefined as
        | undefined
        | {
              system_mxid_localpart: string;
              system_mxid_display_name: string;
              system_mxid_avatar_url: string;
              room_name: string;
          },
    allow_guest_access: false,
    experimental_features: {},
    oidc_providers: [],
    serve_server_wellknown: true,
    presence: {
        enabled: true,
        include_offline_users_on_sync: true,
    },
    room_list_publication_rules: [{ action: "allow" }],
    modules: [] as Array<{ module: string; config?: Record<string, unknown> }>,
};

/**
 * Incomplete type describing the configuration for a Synapse homeserver
 */
export type SynapseConfig = typeof DEFAULT_CONFIG;

/**
 * A Synapse testcontainer
 *
 * Exposes port 8008.
 * Waits for HTTP /health 8008 to 200.
 */
export class SynapseContainer extends GenericContainer implements HomeserverContainer<SynapseConfig> {
    protected config: SynapseConfig;
    protected mas?: StartedMatrixAuthenticationServiceContainer;

    public constructor(image = "ghcr.io/element-hq/synapse:develop") {
        super(image);

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

    public withConfigField(key: string, value: unknown): this {
        set(this.config, key, value);
        return this;
    }

    public withConfig(config: Partial<SynapseConfig>): this {
        this.config = {
            ...this.config,
            ...config,
        };
        return this;
    }

    public withSmtpServer(mailpit: StartedMailpitContainer): this {
        this.config.email = {
            enable_notifs: false,
            smtp_host: mailpit.internalHost,
            smtp_port: mailpit.internalSmtpPort,
            smtp_user: "username",
            smtp_pass: "password",
            require_transport_security: false,
            notif_from: "Your Friendly %(app)s homeserver <noreply@example.com>",
            app_name: "Matrix",
            notif_template_html: "notif_mail.html",
            notif_template_text: "notif_mail.txt",
            notif_for_new_users: true,
            client_base_url: "http://localhost/element",
        };
        return this;
    }

    public withMatrixAuthenticationService(mas?: StartedMatrixAuthenticationServiceContainer): this {
        this.mas = mas;
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

        const container = await super.start();
        const baseUrl = `http://localhost:${port}`;
        if (this.mas) {
            return new StartedSynapseWithMasContainer(
                container,
                baseUrl,
                this.config.registration_shared_secret,
                this.mas,
            );
        }

        return new StartedSynapseContainer(container, baseUrl, this.config.registration_shared_secret);
    }
}

/**
 * A started Synapse testcontainer
 */
export class StartedSynapseContainer extends AbstractStartedContainer implements StartedHomeserverContainer {
    protected adminTokenPromise?: Promise<string>;
    protected readonly adminApi: Api;
    public readonly csApi: ClientServerApi;

    public constructor(
        container: StartedTestContainer,
        public readonly baseUrl: string,
        private readonly registrationSharedSecret: string,
    ) {
        super(container);
        this.adminApi = new Api(`${this.baseUrl}/_synapse/admin`);
        this.csApi = new ClientServerApi(this.baseUrl);
    }

    /**
     * Restart the container
     * Useful to reset the state of the homeserver between tests
     * @param options - options to pass to the restart
     */
    public restart(options?: Partial<RestartOptions>): Promise<void> {
        this.adminTokenPromise = undefined;
        return super.restart(options);
    }

    public setRequest(request: APIRequestContext): void {
        this.csApi.setRequest(request);
        this.adminApi.setRequest(request);
    }

    public async onTestFinished(testInfo: TestInfo): Promise<void> {
        // Clean up the server to prevent rooms leaking between tests
        await this.deletePublicRooms();
    }

    protected async deletePublicRooms(): Promise<void> {
        const token = await this.getAdminToken();
        // We hide the rooms from the room directory to save time between tests and for portability between homeservers
        const { chunk: rooms } = await this.csApi.request<{
            chunk: { room_id: string }[];
        }>("GET", "/v3/publicRooms", token, {});
        await Promise.all(
            rooms.map((room) =>
                this.csApi.request("PUT", `/v3/directory/list/room/${room.room_id}`, token, { visibility: "private" }),
            ),
        );
    }

    private async registerUserInternal(
        username: string,
        password: string,
        displayName?: string,
        admin = false,
    ): Promise<Credentials> {
        const path = "/v1/register";
        const { nonce } = await this.adminApi.request<{ nonce: string }>("GET", path, undefined, {});
        const mac = crypto
            .createHmac("sha1", this.registrationSharedSecret)
            .update(`${nonce}\0${username}\0${password}\0${admin ? "" : "not"}admin`)
            .digest("hex");
        const data = await this.adminApi.request<{
            home_server: string;
            access_token: string;
            user_id: string;
            device_id: string;
        }>("POST", path, undefined, {
            nonce,
            username,
            password,
            mac,
            admin,
            displayname: displayName,
        });

        return {
            homeServer: data.home_server || data.user_id.split(":").slice(1).join(":"),
            homeserverBaseUrl: this.baseUrl,
            accessToken: data.access_token,
            userId: data.user_id,
            deviceId: data.device_id,
            password,
            displayName,
            username,
        };
    }

    protected async getAdminToken(): Promise<string> {
        if (this.adminTokenPromise === undefined) {
            this.adminTokenPromise = this.registerUserInternal(
                "admin",
                "totalyinsecureadminpassword",
                undefined,
                true,
            ).then((res) => res.accessToken);
        }
        return this.adminTokenPromise;
    }

    private async adminRequest<R extends object>(verb: "GET", path: string, data?: never): Promise<R>;
    private async adminRequest<R extends object>(verb: Verb, path: string, data?: object): Promise<R>;
    private async adminRequest<R extends object>(verb: Verb, path: string, data?: object): Promise<R> {
        const adminToken = await this.getAdminToken();
        return this.adminApi.request(verb, path, adminToken, data);
    }

    /**
     * Register a user on the given Homeserver using the shared registration secret.
     * @param username - the username of the user to register
     * @param password - the password of the user to register
     * @param displayName - optional display name to set on the newly registered user
     */
    public registerUser(username: string, password: string, displayName?: string): Promise<Credentials> {
        return this.registerUserInternal(username, password, displayName, false);
    }

    /**
     * Logs into synapse with the given username/password
     * @param userId - login username
     * @param password - login password
     */
    public async loginUser(userId: string, password: string): Promise<Credentials> {
        return {
            ...(await this.csApi.loginUser(userId, password)),
            homeserverBaseUrl: this.baseUrl,
        };
    }

    /**
     * Binds a 3pid
     * @param userId - the username of the user to bind the 3pid to
     * @param medium - the medium of the 3pid to bind
     * @param address - the address of the 3pid to bind
     */
    public async setThreepid(userId: string, medium: string, address: string): Promise<void> {
        await this.adminRequest("PUT", `/v2/users/${userId}`, {
            threepids: [
                {
                    medium,
                    address,
                },
            ],
        });
    }
}

/**
 * A started Synapse container when delegating auth to MAS
 */
export class StartedSynapseWithMasContainer extends StartedSynapseContainer {
    public constructor(
        container: StartedTestContainer,
        baseUrl: string,
        registrationSharedSecret: string,
        private readonly mas: StartedMatrixAuthenticationServiceContainer,
    ) {
        super(container, baseUrl, registrationSharedSecret);
    }

    protected async getAdminToken(): Promise<string> {
        if (this.adminTokenPromise === undefined) {
            this.adminTokenPromise = this.mas.getAdminToken();
        }
        return this.adminTokenPromise;
    }

    /**
     * Register a user on the given Homeserver using the shared registration secret.
     * @param username - the username of the user to register
     * @param password - the password of the user to register
     * @param displayName - optional display name to set on the newly registered user
     */
    public async registerUser(username: string, password: string, displayName?: string): Promise<Credentials> {
        const registered = await this.mas.registerUser(username, password, displayName);
        return { ...registered, homeserverBaseUrl: this.baseUrl };
    }

    /**
     * Binds a 3pid
     * @param userId - the username of the user to bind the 3pid to
     * @param medium - the medium of the 3pid to bind
     * @param address - the address of the 3pid to bind
     */
    public async setThreepid(userId: string, medium: string, address: string): Promise<void> {
        return this.mas.setThreepid(userId, medium, address);
    }
}
