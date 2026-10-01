/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Representation of a Matrix event, as specified by the client server specification.
 * @alpha Subject to change.
 * @see https://spec.matrix.org/v1.14/client-server-api/#room-event-format
 */
export interface MatrixEvent {
    /**
     * The event ID of this event.
     */
    eventId: string;
    /**
     * The room ID which contains this event.
     */
    roomId: string;
    /**
     * The Matrix ID of the user who sent this event.
     */
    sender: string;
    /**
     * The content of the event.
     * If the event was encrypted, this is the decrypted content.
     */
    content: Record<string, unknown>;
    /**
     * Contains optional extra information about the event.
     */
    unsigned: Record<string, unknown>;
    /**
     * The type of the event.
     */
    type: string;
    /**
     * The state key of the event.
     * If this key is set, including `""` then the event is a state event.
     */
    stateKey?: string;
    /**
     * Timestamp (in milliseconds since the unix epoch) on originating homeserver when this event was sent.
     */
    originServerTs: number;
}
