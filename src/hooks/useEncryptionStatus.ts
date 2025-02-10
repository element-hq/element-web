/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { useEffect, useMemo, useState } from "react";
import { throttle } from "lodash";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import { type E2EStatus, shieldStatusForRoom } from "../utils/ShieldUtils";
import { useTypedEventEmitter } from "./useEventEmitter";

export function useEncryptionStatus(client: MatrixClient, room: Room): E2EStatus | null {
    const [e2eStatus, setE2eStatus] = useState<E2EStatus | null>(null);

    const updateEncryptionStatus = useMemo(
        () =>
            throttle(
                () => {
                    if (client.getCrypto()) {
                        shieldStatusForRoom(client, room).then((e2eStatus) => {
                            setE2eStatus(e2eStatus);
                        });
                    }
                },
                250,
                { leading: true, trailing: true },
            ),
        [client, room],
    );

    useEffect(updateEncryptionStatus, [updateEncryptionStatus]);

    // shieldStatusForRoom depends on the room membership, each member's trust
    // status for each member, and each member's devices, so we update the
    // status whenever any of those changes.
    useTypedEventEmitter(room, RoomStateEvent.Members, updateEncryptionStatus);
    useTypedEventEmitter(client, CryptoEvent.UserTrustStatusChanged, updateEncryptionStatus);
    useTypedEventEmitter(client, CryptoEvent.DevicesUpdated, updateEncryptionStatus);

    return e2eStatus;
}
