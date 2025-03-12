/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type AbstractStartedContainer, type GenericContainer } from "testcontainers";
import { type APIRequestContext, type TestInfo } from "@playwright/test";

import { type StartedMatrixAuthenticationServiceContainer } from "./mas";
import { ClientServerApi, Credentials } from "../utils/api";
import { StartedMailpitContainer } from "./mailpit";

export interface HomeserverInstance {
    readonly baseUrl: string;
    readonly csApi: ClientServerApi;

    /**
     * Register a user on the given Homeserver using the shared registration secret.
     * @param username the username of the user to register
     * @param password the password of the user to register
     * @param displayName optional display name to set on the newly registered user
     */
    registerUser(username: string, password: string, displayName?: string): Promise<Credentials>;

    /**
     * Logs into synapse with the given username/password
     * @param userId login username
     * @param password login password
     */
    loginUser(userId: string, password: string): Promise<Credentials>;

    /**
     * Sets a third party identifier for the given user. This only supports setting a single 3pid and will
     * replace any others.
     * @param userId The full ID of the user to edit (as returned from registerUser)
     * @param medium The medium of the 3pid to set
     * @param address The address of the 3pid to set
     */
    setThreepid(userId: string, medium: string, address: string): Promise<void>;
}

export interface HomeserverContainer<Config> extends GenericContainer {
    /**
     * Set a configuration field in the config
     * @param key - the key to set
     * @param value - the value to set
     */
    withConfigField<Key extends keyof Config>(key: Key, value: Config[Key]): this;

    /**
     * Merge a partial configuration into the config
     * @param config - the partial configuration to merge
     */
    withConfig(config: Partial<Config>): this;

    /**
     * Set the SMTP server to use for sending emails
     * @param mailpit - the mailpit container to use
     */
    withSmtpServer(mailpit: StartedMailpitContainer): this;
    /**
     * Set the MAS server to use for delegated auth
     * @param mas - the MAS container to use
     */
    withMatrixAuthenticationService(mas?: StartedMatrixAuthenticationServiceContainer): this;

    /**
     * Start the container
     */
    start(): Promise<StartedHomeserverContainer>;
}

export interface StartedHomeserverContainer extends AbstractStartedContainer, HomeserverInstance {
    /**
     * Set the request context for the APIs
     * @param request - the request context to set
     */
    setRequest(request: APIRequestContext): void;

    /**
     * Clean up the server to prevent rooms leaking between tests
     * @param testInfo - the test info for the test that just finished
     */
    onTestFinished(testInfo: TestInfo): Promise<void>;
}
