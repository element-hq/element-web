/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type UserStatus } from "@element-hq/web-shared-components";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

const logger = rootLogger.getChild("userStatus");

// MSC4426 defines the maximum length of a status to be 256 bytes of UTF-8,
// so we truncate anything longer than that.
const MAX_STATUS_TEXT_BYTES = 256;

export function userStatusTextWithinMaxLength(text: string): boolean {
    const textEncoder = new TextEncoder();
    return textEncoder.encode(text).length <= MAX_STATUS_TEXT_BYTES;
}

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
        emoji: rawUserStatus.emoji,
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

export function setUserStatus(client: MatrixClient, userStatus: UserStatus): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", {
        emoji: userStatus.emoji,
        text: userStatus.text,
    });
}

export function clearUserStatus(client: MatrixClient): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", null);
}
