/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Notification state for a room.
 */
export enum RoomNotifState {
    /** All messages (default) */
    AllMessages = "all_messages",
    /** All messages with sound */
    AllMessagesLoud = "all_messages_loud",
    /** Only mentions and keywords */
    MentionsOnly = "mentions_only",
    /** Muted */
    Mute = "mute",
}
