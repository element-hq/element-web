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

export const useCall = (roomId: string): Call | null => {
    const [call, setCall] = useState(() => CallStore.instance.getCall(roomId));
    useEventEmitter(CallStore.instance, CallStoreEvent.Call, (call: Call | null, forRoomId: string) => {
        if (forRoomId === roomId) setCall(call);
    });
    return call;
};

export const useCallForWidget = (widgetId: string, roomId: string): Call | null => {
    const call = useCall(roomId);
    return call?.widget.id === widgetId ? call : null;
};

export const useConnectionState = (call: Call): ConnectionState =>
    useTypedEventEmitterState(
        call,
        CallEvent.ConnectionState,
        useCallback((state) => state ?? call.connectionState, [call]),
    );

export const useParticipants = (call: Call): Map<RoomMember, Set<string>> =>
    useTypedEventEmitterState(
        call,
        CallEvent.Participants,
        useCallback((state) => state ?? call.participants, [call]),
    );

export const useParticipantCount = (call: Call): number => {
    const participants = useParticipants(call);

    return useMemo(() => {
        let count = 0;
        for (const devices of participants.values()) count += devices.size;
        return count;
    }, [participants]);
};

export const useParticipatingMembers = (call: Call): RoomMember[] => {
    const participants = useParticipants(call);

    return useMemo(() => {
        const members: RoomMember[] = [];
        for (const [member, devices] of participants) {
            // Repeat the member for as many devices as they're using
            for (let i = 0; i < devices.size; i++) members.push(member);
        }
        return members;
    }, [participants]);
};

export const useFull = (call: Call): boolean => {
    return (
        useParticipantCount(call) >=
        (SdkConfig.get("element_call").participant_limit ?? DEFAULTS.element_call.participant_limit!)
    );
};

export const useJoinCallButtonDisabledTooltip = (call: Call): string | null => {
    const isFull = useFull(call);
    const state = useConnectionState(call);

    if (state === ConnectionState.Connecting) return _t("Connecting");
    if (isFull) return _t("Sorry — this call is currently full");
    return null;
};

export const useLayout = (call: ElementCall): Layout =>
    useTypedEventEmitterState(
        call,
        CallEvent.Layout,
        useCallback((state) => state ?? call.layout, [call]),
    );
