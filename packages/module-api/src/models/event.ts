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
     * The wire content of the event — i.e. the content as it appeared on the
     * wire before decryption. For unencrypted events this is the same as
     * `content`. For encrypted events this is the outer `m.room.encrypted`
     * content (ciphertext, device_id, sender_key, etc.) which may also
     * contain fields exposed outside the E2EE envelope.
     */
    wireContent?: Record<string, unknown>;
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
    /**
     * Whether this event is encrypted or not.
     */
    isEncrypted: boolean;
}
