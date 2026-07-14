/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type UserStatus } from "@element-hq/web-shared-components";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

// MSC4426 defines the maximum length of a status to be 256 bytes of UTF-8,
// so we truncate anything longer than that.
const MAX_STATUS_TEXT_BYTES = 256;

// Static Intl.Segmenter for grabbing the first grapheme of a user status emoji.
// We make one and keep it for performance.
const intlSegmenter = new Intl.Segmenter();

/**
 * Checks if a given text is within the maximum allowed length for a user status.
 * @param text The text to check.
 * @returns True if the text is within the maximum length, false otherwise.
 */
export function userStatusTextWithinMaxLength(text: string): boolean {
    const textEncoder = new TextEncoder();
    return textEncoder.encode(text).length <= MAX_STATUS_TEXT_BYTES;
}

/**
 * Validates an object from a user profile and returns a UserStatus object if it contains a valid user status.
 * @param rawUserStatus The raw user status object to validate.
 * @returns A UserStatus object if valid, otherwise undefined.
 */
export function validateUserStatus(rawUserStatus: unknown): UserStatus | undefined {
    if (typeof rawUserStatus !== "object" || rawUserStatus === null) {
        return undefined;
    }
    if ("emoji" in rawUserStatus === false || typeof rawUserStatus.emoji !== "string" || !rawUserStatus.emoji) {
        return undefined;
    }
    if ("text" in rawUserStatus === false || typeof rawUserStatus.text !== "string" || !rawUserStatus.text) {
        return undefined;
    }
    return {
        emoji: [...intlSegmenter.segment(rawUserStatus.emoji)][0]?.segment,
        text: userStatusTextWithinMaxLength(rawUserStatus.text)
            ? rawUserStatus.text
            : `${rawUserStatus.text.slice(0, MAX_STATUS_TEXT_BYTES)}…`,
    };
}

/**
 * Fetch the MSC4426 user status of the given user. Returns undefined if the server does not
 * support extended profiles, the user has no (valid) status, or the status could not be fetched.
 *
 * @param client The Matrix client to fetch the status with.
 * @param userId The ID of the user whose status is being fetched.
 */
export async function fetchUserStatus(client: MatrixClient, userId: string): Promise<UserStatus | undefined> {
    if ((await client.doesServerSupportExtendedProfiles()) === false) {
        return undefined;
    }
    try {
        return validateUserStatus(await client.getExtendedProfileProperty(userId, "org.matrix.msc4426.status"));
    } catch (ex) {
        if (!(ex instanceof MatrixError && ex.errcode === "M_NOT_FOUND")) {
            logger.warn(`Failed to get userStatus for ${userId}`, ex);
        }
        return undefined;
    }
}

/**
 * Sets the MSC4426 user status for the given user.
 *
 * @param client The Matrix client to use.
 * @param userStatus The user status to set.
 */
export function setUserStatus(client: MatrixClient, userStatus: UserStatus): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", {
        emoji: userStatus.emoji,
        text: userStatus.text,
    });
}

/**
 * Clears the MSC4426 user status for the given user.
 *
 * @param client The Matrix client to use.
 */
export function clearUserStatus(client: MatrixClient): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", null);
}
