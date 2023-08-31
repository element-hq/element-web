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

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { E2EStatus, shieldStatusForRoom } from "../utils/ShieldUtils";

export function useEncryptionStatus(client: MatrixClient, room: Room): E2EStatus | null {
    const [e2eStatus, setE2eStatus] = useState<E2EStatus | null>(null);

    useEffect(() => {
        if (client.isCryptoEnabled()) {
            shieldStatusForRoom(client, room).then((e2eStatus) => {
                setE2eStatus(e2eStatus);
            });
        }
    }, [client, room]);

    return e2eStatus;
}
