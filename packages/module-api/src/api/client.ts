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
 * A callback that can modify event content before it is sent.
 *
 * @alpha
 * @param roomId - The ID of the room the event is being sent to.
 * @param content - The event content that is about to be sent. May be mutated in place.
 * @returns The (possibly modified) event content to send.
 */
export type EventContentTransformCallback = (
    roomId: string,
    content: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * A callback that unregisters the transform when called.
 */
export type UnregisterTransformCallback = () => void;

/**
 * Access some limited functionality from the SDK.
 * @public
 */
export interface ClientApi {
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
     * Download the body of an `mxc://` URI via the authenticated media
     * endpoint, returning the raw text. Use for small text/JSON/XML media
     * (e.g. policy files) referenced by state events.
     */
    downloadMxc: (mxcUrl: string) => Promise<string>;

    /**
     * Upload content to the media repository, returning the mxc:// URI.
     *
     * @param content - The content to upload (Blob or File).
     * @param contentType - The MIME type of the content (e.g. "application/xml").
     * @returns The mxc:// URI of the uploaded content.
     */
    uploadContent: (content: Blob | File, contentType?: string) => Promise<string>;

    /**
     * Send a state event to a room.
     *
     * @param roomId - The room to send the event to.
     * @param eventType - The type of state event.
     * @param content - The event content.
     * @param stateKey - The state key (defaults to "").
     */
    sendStateEvent: (
        roomId: string,
        eventType: string,
        content: Record<string, unknown>,
        stateKey?: string,
    ) => Promise<void>;

    /**
     * Adds a callback to transform event content before it is sent.
     * Multiple callbacks will be applied in registration order.
     *
     * @param transform - A callback that receives and returns event content (see {@link EventContentTransformCallback}).
     * @returns A function that unregisters this transform when called.
     */
    registerEventContentTransform(transform: EventContentTransformCallback): UnregisterTransformCallback;

    /**
     * Adds a callback to transform the unencrypted envelope of encrypted events before they are sent.
     * This allows modules to add fields to the outer `m.room.encrypted` event content alongside the ciphertext.
     * Multiple callbacks will be applied in registration order.
     *
     * @param transform - A callback that receives and returns event content (see {@link EventContentTransformCallback}).
     * @returns A function that unregisters this transform when called.
     */
    registerEncryptedEventContentTransform(transform: EventContentTransformCallback): UnregisterTransformCallback;

    /**
     * Returns a promise that resolves when the client is available.
     * Use this to wait for the client to be ready if you're running some code
     * early in the app lifecycle.
     */
    waitForClient(): Promise<void>;
    /**
     * Query the homeserver's advertised capabilities.
     * Wraps GET /_matrix/client/v3/capabilities.
     *
     * @returns The `capabilities` object from the server response.
     */
    getCapabilities(): Promise<Record<string, unknown>>;
}
