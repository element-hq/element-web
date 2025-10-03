/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    AbstractStartedContainer,
    GenericContainer,
    type StartedTestContainer,
    Wait,
    type ExecResult,
} from "testcontainers";
import { type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import * as YAML from "yaml";

import { getFreePort } from "../utils/port.js";
import { deepCopy } from "../utils/object.js";
import { type Credentials } from "../utils/api.js";
// This file can be updated by running:
//
//   curl -sL https://element-hq.github.io/matrix-authentication-service/config.schema.json \
//     | npx json-schema-to-typescript -o packages/element-web-playwright-common/src/testconainers/mas-config.ts
import type { RootConfig as MasConfig } from "./mas-config.js";

export { type MasConfig };

const DEFAULT_CONFIG = {
    http: {
        listeners: [
            {
                name: "web",
                resources: [
                    { name: "discovery" },
                    { name: "human" },
                    { name: "oauth" },
                    { name: "compat" },
                    { name: "graphql" },
                    { name: "assets" },
                ],
                binds: [
                    {
                        address: "[::]:8080",
                    },
                ],
                proxy_protocol: false,
            },
            {
                name: "internal",
                resources: [
                    {
                        name: "health",
                    },
                ],
                binds: [
                    {
                        address: "[::]:8081",
                    },
                ],
                proxy_protocol: false,
            },
        ],
        public_base: "", // Needs to be set
        issuer: "", // Needs to be set
    },
    database: {
        host: "postgres",
        port: 5432,
        database: "postgres",
        username: "postgres",
        password: "p4S5w0rD",
    },
    email: {
        from: '"Authentication Service" <root@localhost>',
        reply_to: '"Authentication Service" <root@localhost>',
        transport: "smtp",
        mode: "plain",
        hostname: "mailpit",
        port: 1025,
        username: "username",
        password: "password",
    },
    secrets: {
        encryption: "984b18e207c55ad5fbb2a49b217481a722917ee87b2308d4cf314c83fed8e3b5",
        keys: [
            {
                kid: "YEAhzrKipJ",
                key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAuIV+AW5vx52I4CuumgSxp6yvKfIAnRdALeZZCoFkIGxUli1B\nS79NJ3ls46oLh1pSD9RrhaMp6HTNoi4K3hnP9Q9v77pD7KwdFKG3UdG1zksIB0s/\n+/Ey/DmX4LPluwBBS7r/LkQ1jk745lENA++oiDqZf2D/uP8jCHlvaSNyVKTqi1ki\nOXPd4T4xBUjzuas9ze5jQVSYtfOidgnv1EzUipbIxgvH1jNt4raRlmP8mOq7xEnW\nR+cF5x6n/g17PdSEfrwO4kz6aKGZuMP5lVlDEEnMHKabFSQDBl7+Mpok6jXutbtA\nuiBnsKEahF9eoj4na4fpbRNPdIVyoaN5eGvm5wIDAQABAoIBAApyFCYEmHNWaa83\nCdVSOrRhRDE9r+c0r79pcNT1ajOjrk4qFa4yEC4R46YntCtfY5Hd1pBkIjU0l4d8\nz8Su9WTMEOwjQUEepS7L0NLi6kXZXYT8L40VpGs+32grBvBFHW0qEtQNrHJ36gMv\nx2rXoFTF7HaXiSJx3wvVxAbRqOE9tBXLsmNHaWaAdWQG5o77V9+zvMri3cAeEg2w\nVkKokb0dza7es7xG3tqS26k69SrwGeeuKo7qCHPH2cfyWmY5Yhv8iOoA59JzzbiK\nUdxyzCHskrPSpRKVkVVwmY3RBt282TmSRG7td7e5ESSj50P2e5BI5uu1Hp/dvU4F\nvYjV7kECgYEA6WqYoUpVsgQiqhvJwJIc/8gRm0mUy8TenI36z4Iim01Nt7fibWH7\nXnsFqLGjXtYNVWvBcCrUl9doEnRbJeG2eRGbGKYAWVrOeFvwM4fYvw9GoOiJdDj4\ncgWDe7eHbHE+UTqR7Nnr/UBfipoNWDh6X68HRBuXowh0Q6tOfxsrRFECgYEAyl/V\n4b8bFp3pKZZCb+KPSYsQf793cRmrBexPcLWcDPYbMZQADEZ/VLjbrNrpTOWxUWJT\nhr8MrWswnHO+l5AFu5CNO+QgV2dHLk+2w8qpdpFRPJCfXfo2D3wZ0c4cv3VCwv1V\n5y7f6XWVjDWZYV4wj6c3shxZJjZ+9Hbhf3/twbcCgYA6fuRRR3fCbRbi2qPtBrEN\nyO3gpMgNaQEA6vP4HPzfPrhDWmn8T5nXS61XYW03zxz4U1De81zj0K/cMBzHmZFJ\nNghQXQmpWwBzWVcREvJWr1Vb7erEnaJlsMwKrSvbGWYspSj82oAxr3hCG+lMOpsw\nb4S6pM+TpAK/EqdRY1WsgQKBgQCGoMaaTRXqL9bC0bEU2XVVCWxKb8c3uEmrwQ7/\n/fD4NmjUzI5TnDps1CVfkqoNe+hAKddDFqmKXHqUOfOaxDbsFje+lf5l5tDVoDYH\nfjTKKdYPIm7CiAeauYY7qpA5Vfq52Opixy4yEwUPp0CII67OggFtPaqY3zwJyWQt\n+57hdQKBgGCXM/KKt7ceUDcNJxSGjvu0zD9D5Sv2ihYlEBT/JLaTCCJdvzREevaJ\n1d+mpUAt0Lq6A8NWOMq8HPaxAik3rMQ0WtM5iG+XgsUqvTSb7NcshArDLuWGnW3m\nMC4rM0UBYAS4QweduUSH1imrwH/1Gu5+PxbiecceRMMggWpzu0Bq\n-----END RSA PRIVATE KEY-----\n",
            },
            {
                kid: "8J1AxrlNZT",
                key: "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIF1cjfIOEdy3BXJ72x6fKpEB8WP1ddZAUJAaqqr/6CpToAoGCCqGSM49\nAwEHoUQDQgAEfHdNuI1Yeh3/uOq2PlnW2vymloOVpwBYebbw4VVsna9xhnutIdQW\ndE8hkX8Yb0pIDasrDiwllVLzSvsWJAI0Kw==\n-----END EC PRIVATE KEY-----\n",
            },
            {
                kid: "3BW6un1EBi",
                key: "-----BEGIN EC PRIVATE KEY-----\nMIGkAgEBBDA+3ZV17r8TsiMdw1cpbTSNbyEd5SMy3VS1Mk/kz6O2Ev/3QZut8GE2\nq3eGtLBoVQigBwYFK4EEACKhZANiAASs8Wxjk/uRimRKXnPr2/wDaXkN9wMDjYQK\nmZULb+0ZP1/cXmuXuri8hUGhQvIU8KWY9PkpV+LMPEdpE54mHPKSLjq5CDXoSZ/P\n9f7cdRaOZ000KQPZfIFR9ujJTtDN7Vs=\n-----END EC PRIVATE KEY-----\n",
            },
            {
                kid: "pkZ0pTKK0X",
                key: "-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIHenfsXYPc5yzjZKUfvmydDR1YRwdsfZYvwHf/2wsYxooAcGBSuBBAAK\noUQDQgAEON1x7Vlu+nA0KvC5vYSOHhDUkfLYNZwYSLPFVT02h9E13yFFMIJegIBl\nAer+6PMZpPc8ycyeH9N+U9NAyliBhQ==\n-----END EC PRIVATE KEY-----\n",
            },
        ],
    },
    passwords: {
        enabled: true,
        schemes: [
            {
                version: 1,
                algorithm: "argon2id",
            },
        ],
        minimum_complexity: 0,
    },
    policy: {
        data: {
            client_registration: {
                // allow non-SSL and localhost URIs
                allow_insecure_uris: true,
            },
        },
    },
    account: {
        password_registration_enabled: true,
    },
    matrix: {
        kind: "synapse",
        secret: "", // Needs to be set
    },
    rate_limiting: {
        login: {
            burst: 10,
            per_second: 1,
        },
        registration: {
            burst: 10,
            per_second: 1,
        },
    },
} satisfies MasConfig;

/**
 * A container running the Matrix Authentication Service.
 *
 * Exposes the MAS API on port 8080 and the health check on port 8081.
 * Waits for HTTP /health on port 8081 to be available.
 */
export class MatrixAuthenticationServiceContainer extends GenericContainer {
    private config: MasConfig;
    private readonly args = ["-c", "/config/config.yaml"];

    public constructor(
        db: StartedPostgreSqlContainer,
        image: string = "ghcr.io/element-hq/matrix-authentication-service:latest",
    ) {
        super(image);

        const initialConfig = deepCopy(DEFAULT_CONFIG);
        initialConfig.database.username = db.getUsername();
        initialConfig.database.password = db.getPassword();

        this.config = initialConfig;

        this.withExposedPorts(8080, 8081)
            .withWaitStrategy(Wait.forHttp("/health", 8081))
            .withCommand(["server", ...this.args]);
    }

    /**
     * Adds additional configuration to the MAS config.
     * @param config - additional config fields to add
     */
    public withConfig(config: Partial<MasConfig>): this {
        this.config = {
            ...this.config,
            ...config,
        };
        return this;
    }

    /**
     * Starts the MAS container
     */
    public override async start(): Promise<StartedMatrixAuthenticationServiceContainer> {
        // MAS config issuer needs to know what URL it'll be accessed from, so we have to map the port manually
        const port = await getFreePort();

        this.config.http = {
            ...this.config.http,
            public_base: `http://localhost:${port}/`,
            issuer: `http://localhost:${port}/`,
        };

        this.withExposedPorts({
            container: 8080,
            host: port,
        }).withCopyContentToContainer([
            {
                target: "/config/config.yaml",
                content: YAML.stringify(this.config),
            },
        ]);

        return new StartedMatrixAuthenticationServiceContainer(
            await super.start(),
            `http://localhost:${port}`,
            this.args,
        );
    }
}

/**
 * A started Matrix Authentication Service container.
 */
export class StartedMatrixAuthenticationServiceContainer extends AbstractStartedContainer {
    private adminTokenPromise?: Promise<string>;

    public constructor(
        container: StartedTestContainer,
        public readonly baseUrl: string,
        private readonly args: string[],
    ) {
        super(container);
    }

    /**
     * Retrieves a valid HS admin token
     */
    public async getAdminToken(): Promise<string> {
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

    public async manage(cmd: string, ...args: string[]): Promise<ExecResult> {
        const result = await this.exec(["mas-cli", "manage", cmd, ...this.args, ...args]);
        if (result.exitCode !== 0) {
            throw new Error(`Failed mas-cli manage ${cmd}: ${result.output}`);
        }
        return result;
    }

    private async manageRegisterUser(
        username: string,
        password: string,
        displayName?: string,
        admin = false,
    ): Promise<string> {
        const args: string[] = [];
        if (admin) args.push("-a");
        const result = await this.manage(
            "register-user",
            ...args,
            "-y",
            "-p",
            password,
            "-d",
            displayName ?? "",
            username,
        );

        const registerLines = result.output.trim().split("\n");
        const userId = registerLines
            .find((line) => line.includes("Matrix ID: "))
            ?.split(": ")
            .pop();

        if (!userId) {
            throw new Error(`Failed to register user: ${result.output}`);
        }

        return userId;
    }

    private async manageIssueCompatibilityToken(
        username: string,
        admin = false,
    ): Promise<{ accessToken: string; deviceId: string }> {
        const args: string[] = [];
        if (admin) args.push("--yes-i-want-to-grant-synapse-admin-privileges");
        const result = await this.manage("issue-compatibility-token", ...args, username);

        const parts = result.output.trim().split(/\s+/);
        const accessToken = parts.find((part) => part.startsWith("mct_"));
        const deviceId = parts.find((part) => part.startsWith("compat_session.device="))?.split("=")[1];

        if (!accessToken || !deviceId) {
            throw new Error(`Failed to issue compatibility token: ${result.output}`);
        }

        return { accessToken, deviceId };
    }

    private async registerUserInternal(
        username: string,
        password: string,
        displayName?: string,
        admin = false,
    ): Promise<Omit<Credentials, "homeserverBaseUrl">> {
        const userId = await this.manageRegisterUser(username, password, displayName, admin);
        const { deviceId, accessToken } = await this.manageIssueCompatibilityToken(username, admin);

        return {
            userId,
            accessToken,
            deviceId,
            homeServer: userId.slice(1).split(":").slice(1).join(":"),
            displayName,
            username,
            password,
        };
    }

    /**
     * Registers a user
     *
     * @param username - the username of the user to register
     * @param password - the password of the user to register
     * @param displayName - optional display name to set on the newly registered user
     */
    public async registerUser(
        username: string,
        password: string,
        displayName?: string,
    ): Promise<Omit<Credentials, "homeserverBaseUrl">> {
        return this.registerUserInternal(username, password, displayName, false);
    }

    /**
     * Binds a 3pid
     * @param username - the username of the user to bind the 3pid to
     * @param medium - the medium of the 3pid to bind
     * @param address - the address of the 3pid to bind
     */
    public async setThreepid(username: string, medium: string, address: string): Promise<void> {
        if (medium !== "email") {
            throw new Error("Only email threepids are supported by MAS");
        }

        await this.manage("add-email", username, address);
    }
}
