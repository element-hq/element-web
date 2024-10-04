/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { shouldForceDisableEncryption } from "./shouldForceDisableEncryption";

/**
 * If encryption is force disabled AND the user is not in any encrypted rooms
 * skip setting up encryption
 * @param client
 * @returns {boolean} true when we can skip settings up encryption
 */
export const shouldSkipSetupEncryption = (client: MatrixClient): boolean => {
    const isEncryptionForceDisabled = shouldForceDisableEncryption(client);
    return isEncryptionForceDisabled && !client.getRooms().some((r) => client.isRoomEncrypted(r.roomId));
};
