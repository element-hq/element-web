/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useState } from "react";
import { type AccountDataEvents, ClientEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "./useEventEmitter";

const tryGetContent = <T extends object>(ev?: MatrixEvent): T | undefined => ev?.getContent<T>();

// Hook to simplify listening to Matrix account data
export const useAccountData = <T extends object>(cli: MatrixClient, eventType: keyof AccountDataEvents): T => {
    const [value, setValue] = useState<T | undefined>(() => tryGetContent<T>(cli.getAccountData(eventType)));

    const handler = useCallback(
        (event: MatrixEvent) => {
            if (event.getType() !== eventType) return;
            setValue(event.getContent<T>());
        },
        [eventType],
    );
    useTypedEventEmitter(cli, ClientEvent.AccountData, handler);

    return value || ({} as T);
};

// Currently not used, commenting out otherwise the dead code CI is unhappy.
// But this code is valid and probably will be needed.

// export const useRoomAccountData = <T extends {}>(room: Room, eventType: string): T => {
//     const [value, setValue] = useState<T | undefined>(() => tryGetContent<T>(room.getAccountData(eventType)));

//     const handler = useCallback(
//         (event) => {
//             if (event.getType() !== eventType) return;
//             setValue(event.getContent());
//         },
//         [eventType],
//     );
//     useTypedEventEmitter(room, RoomEvent.AccountData, handler);

//     return value || ({} as T);
// };
