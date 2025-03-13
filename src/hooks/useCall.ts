/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState, useCallback, useMemo } from "react";

import type { RoomMember } from "matrix-js-sdk/src/matrix";
import { type Call, ConnectionState, CallEvent } from "../models/Call";
import { useTypedEventEmitterState, useEventEmitter } from "./useEventEmitter";
import { CallStore, CallStoreEvent } from "../stores/CallStore";
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

export const useConnectionState = (call: Call | null): ConnectionState =>
    useTypedEventEmitterState(
        call ?? undefined,
        CallEvent.ConnectionState,
        useCallback((state) => state ?? call?.connectionState ?? ConnectionState.Disconnected, [call]),
    );

export const useParticipants = (call: Call | null): Map<RoomMember, Set<string>> => {
    return useTypedEventEmitterState(
        call ?? undefined,
        CallEvent.Participants,
        useCallback((state) => state ?? call?.participants ?? [], [call]),
    );
};

export const useParticipantCount = (call: Call | null): number => {
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

export const useFull = (call: Call | null): boolean => {
    return (
        useParticipantCount(call) >=
        (SdkConfig.get("element_call").participant_limit ?? DEFAULTS.element_call.participant_limit!)
    );
};

export const useJoinCallButtonDisabledTooltip = (call: Call | null): string | null => {
    const isFull = useFull(call);
    return isFull ? _t("voip|join_button_tooltip_call_full") : null;
};
