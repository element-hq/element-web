/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * The module API's minimal, detached, mutable copy of a room state event.
 * @alpha
 */
export interface RoomStateEvent {
    /** The event's state key. The empty string is a valid state key. */
    stateKey: string;
    /** The event content, copied from the SDK and treated as untrusted data. */
    content: Record<string, unknown>;
}
