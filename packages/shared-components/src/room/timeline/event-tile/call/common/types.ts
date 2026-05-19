/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Represents whether a call is a voice call or video call.
 */
export const enum CallType {
    /**
     * This is a voice call.
     */
    Voice = "voice",
    /**
     * This is a video call.
     */
    Video = "video",
}

/**
 * The snapshot that both the call started and call declined tiles expect.
 */
export type CallTileViewSnapshot = {
    /**
     * What type of call this tile needs to render for.
     */
    type: CallType;
    /**
     * Time when this call was started.
     */
    timestamp: string;
    /**
     * Whether this call was declined by our user.
     * Undefined if not rendering a declined call tile.
     */
    isCallDeclinedByUs?: boolean;
};
