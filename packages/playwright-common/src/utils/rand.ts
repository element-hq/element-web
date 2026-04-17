/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import crypto from "node:crypto";

/**
 * Generate a random base64 string of the given number of bytes.
 * @param numBytes - The number of bytes to generate.
 */
export function randB64Bytes(numBytes: number): string {
    return crypto.randomBytes(numBytes).toString("base64").replace(/=*$/, "");
}
