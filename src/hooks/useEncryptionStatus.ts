/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
