/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "../models/Room";
import { type Watchable } from "./watchable";

/**
 * Modify account data stored on the homeserver.
 * @public
 */
export interface AccountDataApi {
    /**
     * Returns a watchable with account data for this event type.
     */
    get(eventType: string): Watchable<unknown>;
    /**
     * Set account data on the homeserver.
     */
    set(eventType: string, content: unknown): Promise<void>;
    /**
     * Changes the content of this event to be empty.
     */
    delete(eventType: string): Promise<void>;
}

/**
 * Access some limited functionality from the SDK.
 * @public
 */
export interface ClientApi {
    /**
     * Allows modules to modify aspects of the way the matrix-js-sdk client is created and configured.
     * @alpha Subject to change.
     */
    readonly creationManagement: ClientCreationManagementApi;

    /**
     * Use this to modify account data on the homeserver.
     */
    accountData: AccountDataApi;

    /**
     * Fetch room by id from SDK.
     * @param id - Id of the room to get
     * @returns Room object from SDK
     */
    getRoom: (id: string) => Room | null;

    /**
     * Make a `fetch` request with the client's access token added as an `Authorization: Bearer` header.
     * Takes the same arguments as `fetch`. The arguments passed in are not modified.
     * @param input - The resource to fetch.
     * @param init - Options for the request. Must not set an `Authorization` header.
     * @returns The response from `fetch`. Rejects if the client isn't ready yet, has no access token, or the
     * request already has an `Authorization` header.
     */
    doAuthenticatedRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

    /**
     * Wait for the client to be started.
     * Resolves immediately if the client has already started. If the user logs out, the next call waits for the
     * client to start again.
     * @returns A promise that resolves once the client has started.
     */
    waitForClientStarted(): Promise<void>;
}

/**
 * Options for configuring experimental X.509 signature verification.
 * @public
 * @alpha
 */
export interface X509ClientInitOpts {
    /**
     * Optional PEM-formatted string that provides CA certificates. These will be used to check
     * X.509 signatures on user identities. Any user identity that has a valid signature according to the supplied
     * CAs will be considered verified, without any manual verification taking place.
     */
    userVerificationCaCertsPem?: string;

    /**
     * Optional async function for signing some data with an X.509 certificate. Used to sign
     * the user's identity so compatible clients will recognise this user as verified without manual verification
     * taking place. If you supply this you must also supply `x509Validity`.
     */
    signer?: (item: Uint8Array) => Promise<{
        signature_bytes: Uint8Array;
        certificate_chain: string;
        signature_scheme: "RsaPssSha512";
    }>;

    /**
     * Optional function returning the validity period of the X.509 certificate used for
     * signing, as the number of milliseconds since the Unix epoch. If you supply this you must also supply
     * `x509Signer`.
     */
    validity?: () => number;
}

/**
 * Methods which manage aspects of the way the matrix-js-sdk Client is created and configured.
 * @public
 * @alpha
 */
export interface ClientCreationManagementApi {
    /**
     * Configure the crypto stack to use experimental X.509-based identity verification.
     * Successive calls are merged, so each caller need only supply the fields it owns.
     *
     * @param opts - Configuration for X.509. See {@link X509ClientInitOpts} for more details.
     */
    setX509ClientInitOpts(opts: X509ClientInitOpts): void;

    /**
     * Supply CA certificates used to check X.509 signatures on user identities.
     *
     * @param pem - PEM-formatted CA certificates, or null to supply none.
     *
     * @deprecated Use {@link ClientCreationManagementApi.setX509ClientInitOpts} instead, which also
     * carries the signing half. Retained so modules built against 1.17.0 and earlier keep working.
     */
    setUserVerificationCaCertsPem(pem: string | null): void;
}
