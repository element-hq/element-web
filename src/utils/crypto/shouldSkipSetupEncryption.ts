/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { shouldForceDisableEncryption } from "./shouldForceDisableEncryption";
import { asyncSomeParallel } from "../arrays.ts";

/**
 * If encryption is force disabled AND the user is not in any encrypted rooms
 * skip setting up encryption
 * @param client
 * @returns {boolean} true when we can skip settings up encryption
 */
export const shouldSkipSetupEncryption = async (client: MatrixClient): Promise<boolean> => {
    const isEncryptionForceDisabled = shouldForceDisableEncryption(client);
    const crypto = client.getCrypto();
    if (!crypto) return true;

    return (
        isEncryptionForceDisabled &&
        !(await asyncSomeParallel(client.getRooms(), ({ roomId }) => crypto.isEncryptionEnabledInRoom(roomId)))
    );
};
