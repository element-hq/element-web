/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Possible values for the "filter" setting in the poll history dialog
 *
 * Ended polls have a valid M_POLL_END event
 */
export type PollHistoryFilter = "ACTIVE" | "ENDED";
