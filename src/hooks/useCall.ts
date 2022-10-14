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

import { useState, useCallback, useMemo } from "react";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { Call, ConnectionState, ElementCall, Layout } from "../models/Call";
import { useTypedEventEmitterState } from "./useEventEmitter";
import { CallEvent } from "../models/Call";
import { CallStore, CallStoreEvent } from "../stores/CallStore";
import { useEventEmitter } from "./useEventEmitter";
import SdkConfig, { DEFAULTS } from "../SdkConfig";
import { _t } from "../languageHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";

export const useCall = (roomId: string): Call | null => {
    const [call, setCall] = useState(() => CallStore.instance.getCall(roomId));
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

export const useFull = (call: Call): boolean => {
    const participants = useParticipants(call);

    return (
        participants.size
        >= (SdkConfig.get("element_call").participant_limit ?? DEFAULTS.element_call.participant_limit)
    );
};

export const useIsAlreadyParticipant = (call: Call): boolean => {
    const client = MatrixClientPeg.get();
    const participants = useParticipants(call);

    return useMemo(() => {
        return participants.has(client.getRoom(call.roomId).getMember(client.getUserId()));
    }, [participants, client, call]);
};

export const useJoinCallButtonTooltip = (call: Call): string | null => {
    const isFull = useFull(call);
    const state = useConnectionState(call);
    const isAlreadyParticipant = useIsAlreadyParticipant(call);

    if (state === ConnectionState.Connecting) return _t("Connecting");
    if (isFull) return _t("Sorry — this call is currently full");
    if (isAlreadyParticipant) return _t("You have already joined this call from another device");
    return null;
};

export const useJoinCallButtonDisabled = (call: Call): boolean => {
    const isFull = useFull(call);
    const state = useConnectionState(call);

    return isFull || state === ConnectionState.Connecting;
};

export const useLayout = (call: ElementCall): Layout =>
    useTypedEventEmitterState(
        call,
        CallEvent.Layout,
        useCallback(state => state ?? call.layout, [call]),
    );
