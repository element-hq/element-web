/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

interface FilterValidMDirectResult {
    /** Whether the entire content is valid */
    valid: boolean;
    /** Filtered content with only the valid parts */
    filteredContent: Record<string, string[]>;
}

/**
 * Filter m.direct content to be compliant to https://spec.matrix.org/v1.6/client-server-api/#mdirect.
 *
 * @param content - Raw event content to be filerted
 * @returns value as a flag whether to content was valid.
 *          filteredContent with only values from the content that are spec compliant.
 */
export const filterValidMDirect = (content: unknown): FilterValidMDirectResult => {
    if (content === null || typeof content !== "object") {
        return {
            valid: false,
            filteredContent: {},
        };
    }

    const filteredContent = new Map();
    let valid = true;

    for (const [userId, roomIds] of Object.entries(content)) {
        if (typeof userId !== "string") {
            valid = false;
            continue;
        }

        if (!Array.isArray(roomIds)) {
            valid = false;
            continue;
        }

        const filteredRoomIds: string[] = [];
        filteredContent.set(userId, filteredRoomIds);

        for (const roomId of roomIds) {
            if (typeof roomId === "string") {
                filteredRoomIds.push(roomId);
            } else {
                valid = false;
            }
        }
    }

    return {
        valid,
        filteredContent: Object.fromEntries(filteredContent.entries()),
    };
};
