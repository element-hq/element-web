/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Representation of a Matrix event.
 * @beta
 */
export interface MatrixEvent {
    eventId: string;
    roomId?: string;
    sender: string;
    content: Record<string, unknown>;
    unsigned: Record<string, unknown>;
    type: string;
    stateKey?: string;
    originServerTs: number;
    redacts?: string;
    age?: number;
}
