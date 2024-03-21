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
