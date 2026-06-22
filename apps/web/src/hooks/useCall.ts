/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState, useCallback, useMemo, useEffect, useContext } from "react";

import type { RoomMember } from "matrix-js-sdk/src/matrix";
import { type Call, ConnectionState, CallEvent } from "../models/Call";
import { useTypedEventEmitterState, useEventEmitter } from "./useEventEmitter";
import { CallStoreEvent } from "../stores/CallStore";
import { SDKContext } from "../contexts/SDKContext.ts";

export const useCall = (roomId: string): Call | null => {
    const sdkContext = useContext(SDKContext);
    const [call, setCall] = useState(() => sdkContext.callStore.getCall(roomId));
    useEventEmitter(sdkContext.callStore, CallStoreEvent.Call, (call: Call | null, forRoomId: string) => {
        if (forRoomId === roomId) setCall(call);
    });

    // Reset the value when the roomId changes
    useEffect(() => {
        setCall(sdkContext.callStore.getCall(roomId));
    }, [roomId, sdkContext.callStore]);

    return call;
};

export const useConnectionState = (call: Call | null): ConnectionState =>
    useTypedEventEmitterState(
        call ?? undefined,
        CallEvent.ConnectionState,
        useCallback((state) => state ?? call?.connectionState ?? ConnectionState.Disconnected, [call]),
    );

const useParticipants = (call: Call | null): Map<RoomMember, Set<string>> => {
    return useTypedEventEmitterState(
        call ?? undefined,
        CallEvent.Participants,
        useCallback((state) => state ?? call?.participants ?? [], [call]),
    );
};

export const useParticipantCount = (call: Call | null): number => {
    const participants = useParticipants(call);

    return useMemo(() => {
        return [...participants.values()].reduce<number>((count, set) => count + set.size, 0);
    }, [participants]);
};

export const useParticipatingMembers = (call: Call | null): RoomMember[] => {
    const participants = useParticipants(call);
    return useMemo(() => [...participants.keys()], [participants]);
};
