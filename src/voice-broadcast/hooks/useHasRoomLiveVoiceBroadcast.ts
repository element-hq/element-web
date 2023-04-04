/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
