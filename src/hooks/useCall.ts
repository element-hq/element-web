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

import { useState, useCallback } from "react";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { Call, ConnectionState } from "../models/Call";
import { useTypedEventEmitterState } from "./useEventEmitter";
import { CallEvent } from "../models/Call";
import { CallStore, CallStoreEvent } from "../stores/CallStore";
import { useEventEmitter } from "./useEventEmitter";

export const useCall = (roomId: string): Call | null => {
    const [call, setCall] = useState(() => CallStore.instance.get(roomId));
    useEventEmitter(CallStore.instance, CallStoreEvent.Call, (call: Call | null, forRoomId: string) => {
        if (forRoomId === roomId) setCall(call);
    });
    return call;
};

export const useConnectionState = (call: Call): ConnectionState =>
    useTypedEventEmitterState(
        call,
        CallEvent.ConnectionState,
        useCallback(state => state ?? call.connectionState, [call]),
    );

export const useParticipants = (call: Call): Set<RoomMember> =>
    useTypedEventEmitterState(
        call,
        CallEvent.Participants,
        useCallback(state => state ?? call.participants, [call]),
    );
