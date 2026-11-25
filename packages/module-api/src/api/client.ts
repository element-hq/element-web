/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "../models/Room";
import { type Watchable } from "./watchable";

/**
 * A to-device message sent through the current Matrix session.
 * @alpha
 */
export interface OutgoingToDeviceMessage {
    /** Matrix user that should receive the message. */
    readonly recipientUserId: string;
    /** A specific recipient device, or "*" to send to all of the user's devices. */
    readonly recipientDeviceId: string;
    /** Event type of the message. */
    readonly type: string;
    /** Message content. The caller owns any protocol fields, including correlation IDs. */
    readonly content: Record<string, unknown>;
}

/**
 * A to-device message received by the current Matrix session.
 * @alpha
 */
export interface IncomingToDeviceMessage {
    /** Event type of the message. */
    readonly type: string;
    /** Matrix user who sent the message. */
    readonly sender: string;
    /** Unvalidated message content; the caller must validate its protocol. */
    readonly content: unknown;
}

/**
 * Send messages through the current Matrix session and subscribe across sessions.
 * @alpha
 */
export interface ToDeviceApi {
    /**
     * Sends one message through the current Matrix session.
     *
     * Resolves when the send completes; it does not wait for a response.
     *
     * @param message - Recipient, event type, and content.
     */
    sendMessage(message: OutgoingToDeviceMessage): Promise<void>;

    /**
     * Listens for messages of one exact event type across Matrix sessions.
     *
     * Registration does not require an active session or a preceding send. Delivery pauses on logout and
     * resumes for the next session until the caller unsubscribes. Callers must clear session-specific state
     * when the profile changes.
     *
     * @param type - Event type to receive.
     * @param listener - Called with untrusted message data.
     * @returns An idempotent function that stops this listener.
     */
    onMessage(type: string, listener: (message: IncomingToDeviceMessage) => void): () => void;
}

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
     * Send to the current session and subscribe to messages across sessions.
     * @alpha Subject to change.
     */
    readonly toDevice: ToDeviceApi;

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
