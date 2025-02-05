/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ClientServerApi } from "../utils/api.ts";

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

export interface Credentials {
    accessToken: string;
    userId: string;
    deviceId: string;
    homeServer: string;
    password: string | null; // null for password-less users
    displayName?: string;
    username: string; // the localpart of the userId
}

export type HomeserverType = "synapse" | "dendrite" | "pinecone";
