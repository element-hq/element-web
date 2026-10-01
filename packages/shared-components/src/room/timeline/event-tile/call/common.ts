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
 * Whether the call is incoming or outgoing.
 */
export const enum CallDirection {
    Incoming = "Incoming",
    Outgoing = "Outgoing",
}
