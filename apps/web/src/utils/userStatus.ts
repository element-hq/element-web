/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type UserStatus } from "@element-hq/web-shared-components";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

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

export function setUserStatus(client: MatrixClient, userStatus: UserStatus): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", {
        emoji: userStatus.emoji,
        text: userStatus.text,
    });
}

export function clearUserStatus(client: MatrixClient): Promise<void> {
    return client.setExtendedProfileProperty("org.matrix.msc4426.status", null);
}
