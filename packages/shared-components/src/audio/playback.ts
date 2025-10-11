/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Represents the possible states of playback.
 * - "preparing": The audio is being prepared for playback (e.g., loading or buffering).
 * - "decoding": The audio is being decoded and is not ready for playback.
 * - "stopped": The playback has been stopped, with no progress on the timeline.
 * - "paused": The playback is paused, with some progress on the timeline.
 * - "playing": The playback is actively progressing through the timeline.
 */
export type PlaybackState = "decoding" | "stopped" | "paused" | "playing" | "preparing";
