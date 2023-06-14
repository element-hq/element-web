/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
