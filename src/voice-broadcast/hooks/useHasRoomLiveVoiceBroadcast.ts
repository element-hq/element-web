/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useContext, useEffect, useMemo, useState } from "react";
import { Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { hasRoomLiveVoiceBroadcast } from "../utils/hasRoomLiveVoiceBroadcast";
import { useTypedEventEmitter } from "../../hooks/useEventEmitter";
import { SDKContext } from "../../contexts/SDKContext";

export const useHasRoomLiveVoiceBroadcast = (room: Room): boolean => {
    const sdkContext = useContext(SDKContext);
    const [hasLiveVoiceBroadcast, setHasLiveVoiceBroadcast] = useState(false);

    const update = useMemo(() => {
        return sdkContext?.client
            ? () => {
                  hasRoomLiveVoiceBroadcast(sdkContext.client!, room).then(
                      ({ hasBroadcast }) => {
                          setHasLiveVoiceBroadcast(hasBroadcast);
                      },
                      () => {}, // no update on error
                  );
              }
            : () => {}; // noop without client
    }, [room, sdkContext, setHasLiveVoiceBroadcast]);

    useEffect(() => {
        update();
    }, [update]);

    useTypedEventEmitter(room.currentState, RoomStateEvent.Update, () => update());
    return hasLiveVoiceBroadcast;
};
