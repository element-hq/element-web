/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
    type Room,
    type MatrixEvent,
    type RoomMember,
    RoomEvent,
    EventType,
    MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import { SDKContext } from "../contexts/SDKContext";
import defaultDispatcher from "../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import ToastStore from "../stores/ToastStore";
import { useCall, useParticipatingMembers } from "./useCall";
import { type ButtonEvent } from "../components/views/elements/AccessibleButton";
import { type Call, CallEvent } from "../models/Call";
import { AudioID } from "../LegacyCallHandler";
import { useEventEmitter, useTypedEventEmitter } from "./useEventEmitter";
import { CallStore, CallStoreEvent } from "../stores/CallStore";
import DMRoomMap from "../utils/DMRoomMap";
import { useDispatcher } from "./useDispatcher";
import { type ActionPayload } from "../dispatcher/payloads";

/**
 * Get the ts when the notification event was sent (see {@link IncomingCallToast}).
 */
export const getNotificationEventSendTs = (event: MatrixEvent): number => {
    const content = event.getContent() as Partial<IRTCNotificationContent>;
    const sendTs = content.sender_ts;
    if (sendTs && Math.abs(sendTs - event.getTs()) >= 15000) {
        return event.getTs();
    }
    return sendTs ?? event.getTs();
};

const MAX_RING_TIME_MS = 90 * 1000;

export interface IncomingCallToastState {
    /** The room the call is in, if known. */
    room?: Room;
    /** Whether this is an audio-only call. */
    isVoice: boolean;
    /** Whether the notification is a "ring" (1:1/explicit) rather than a group "notify". */
    isRing: boolean;
    /** The 1:1 counterparty's user id, if this is a DM call. */
    otherUserId?: string;
    /** Members currently participating in the call. */
    members: RoomMember[];
    /** True if the user is already connected to a different call. */
    otherCallIsOngoing: boolean;
    /** Join-with-video toggle state (video calls only). */
    videoToggle: boolean;
    setVideoToggle: (value: boolean) => void;
    /** Join the call (skipping the lobby). */
    onJoin: (e?: ButtonEvent) => void;
    /** Open the call in the room (showing the lobby). */
    onExpand: (e?: ButtonEvent) => void;
    /** Decline the incoming call and dismiss. */
    onDecline: (e: ButtonEvent) => Promise<void>;
    /** Dismiss the toast/popup and stop ringing. */
    dismiss: () => void;
}

/**
 * All lifecycle and actions for an incoming Element Call (MatrixRTC) notification:
 * ringing, the ring timeout, auto-dismissal (remote decline, answered elsewhere,
 * session ended, redaction, viewing the call), and the join/decline actions.
 *
 * Shared between the compact {@link IncomingCallToast} and the prominent
 * full-screen {@link IncomingCallView} so both surfaces behave identically.
 */
export function useIncomingCallToast(notificationEvent: MatrixEvent, toastKey: string): IncomingCallToastState {
    const sdkContext = useContext(SDKContext);
    const legacyCallHandler = sdkContext.legacyCallHandler;
    const roomId = notificationEvent.getRoomId()!;
    const notificationContent = notificationEvent.getContent() as Partial<IRTCNotificationContent>;
    const room = sdkContext.client?.getRoom(roomId) ?? undefined;
    const call = useCall(roomId);

    const otherRoomHasCall = (): boolean =>
        Array.from(CallStore.instance.connectedCalls).some((c) => c.roomId !== roomId);
    const [otherCallIsOngoing, setOtherCallIsOngoing] = useState<boolean>(otherRoomHasCall);
    useEventEmitter(CallStore.instance, CallStoreEvent.ConnectedCalls, () => {
        setOtherCallIsOngoing(otherRoomHasCall());
    });

    const isRing = notificationContent.notification_type === "ring";

    // Start ringing for a "ring" notification, and stop on unmount as a backstop
    // for surfaces that disappear without going through dismiss() (e.g. the toast
    // being filtered out when the full-screen setting toggles, or a store reset).
    const soundHasStarted = useRef<boolean>(false);
    useEffect(() => {
        if (isRing && !soundHasStarted.current && !legacyCallHandler.isPlaying(AudioID.Ring)) {
            soundHasStarted.current = true;
            void legacyCallHandler.play(AudioID.Ring);
        }
        return () => {
            if (soundHasStarted.current) legacyCallHandler.pause(AudioID.Ring);
        };
    }, [isRing, legacyCallHandler]);

    const dismiss = useCallback((): void => {
        ToastStore.sharedInstance().dismissToast(toastKey);
        legacyCallHandler.pause(AudioID.Ring);
    }, [toastKey, legacyCallHandler]);

    // Dismiss if the notification/call event is redacted.
    // NOTE: this condition is effectively always-true (pre-existing behaviour
    // carried over from IncomingCallToast): the array is built from `ev` and then
    // tested against `ev.getId()`. It dismisses on any redaction in the room. Left
    // as-is to preserve behaviour and existing tests; tracked for a separate fix.
    useTypedEventEmitter(room, MatrixEventEvent.BeforeRedaction, (ev: MatrixEvent) => {
        if ([ev.getId(), ev.getRelation()?.event_id].includes(ev.getId())) {
            dismiss();
        }
    });

    // Dismiss if the session ended remotely.
    const onCall = useCallback(
        (c: Call, callRoomId: string): void => {
            if (callRoomId !== notificationEvent.getRoomId()) return;
            if (c === null || c.participants.size === 0) {
                dismiss();
            }
        },
        [dismiss, notificationEvent],
    );

    // Dismiss if we declined from this device (our own RTCDecline).
    const onTimelineChange = useCallback(
        (ev: MatrixEvent) => {
            const userId = room?.client.getUserId();
            if (
                ev.getType() === EventType.RTCDecline &&
                userId !== undefined &&
                ev.getSender() === userId &&
                ev.relationEventId === notificationEvent.getId()
            ) {
                dismiss();
            }
        },
        [dismiss, notificationEvent, room?.client],
    );

    // Dismiss if another of our devices joins.
    const onParticipantChange = useCallback(
        (participants: Map<RoomMember, Set<string>>) => {
            if (Array.from(participants.keys()).some((p) => p.userId == room?.client.getUserId())) {
                dismiss();
            }
        },
        [dismiss, room?.client],
    );

    // Dismiss on timeout.
    useEffect(() => {
        const lifetime = notificationContent.lifetime ?? MAX_RING_TIME_MS;
        const timeout = setTimeout(dismiss, getNotificationEventSendTs(notificationEvent) + lifetime - Date.now());
        return () => clearTimeout(timeout);
    }, [dismiss, notificationEvent, notificationContent.lifetime]);

    const [videoToggle, setVideoToggle] = useState(true);
    const isVoice = notificationContent["m.call.intent"] === "audio";

    const viewCall = useCallback(
        (skipLobby: boolean) => {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room?.roomId,
                view_call: true,
                skipLobby,
                voiceOnly: isVoice || !videoToggle,
                metricsTrigger: undefined,
            });
        },
        [room, isVoice, videoToggle],
    );

    // Dismiss (stop the ring, remove the toast) up front so accepting is instant
    // and reliable even if the ViewRoom dispatch below no-ops (e.g. the room isn't
    // loaded yet); the dispatcher watcher would otherwise be the only dismiss path.
    const onJoin = useCallback(() => {
        dismiss();
        viewCall(true);
    }, [dismiss, viewCall]);
    const onExpand = useCallback(() => viewCall(false), [viewCall]);

    // Dismiss once the call is being viewed.
    useDispatcher(
        defaultDispatcher,
        useCallback(
            (payload: ActionPayload) => {
                if (payload.action === Action.ViewRoom && payload.room_id === roomId && payload.view_call) {
                    dismiss();
                }
            },
            [roomId, dismiss],
        ),
    );

    // Guard against a double-click sending two RTCDecline events for one ring: the
    // toast stays interactive until the async send resolves.
    const declining = useRef(false);
    const onDecline = useCallback(
        async (e: ButtonEvent): Promise<void> => {
            e.stopPropagation();
            if (declining.current) return;
            declining.current = true;
            await room?.client.sendRtcDecline(room.roomId, notificationEvent.getId() ?? "");
            dismiss();
        },
        [room, notificationEvent, dismiss],
    );

    useEventEmitter(CallStore.instance, CallStoreEvent.Call, onCall);
    useEventEmitter(call ?? undefined, CallEvent.Participants, onParticipantChange);
    useEventEmitter(room, RoomEvent.Timeline, onTimelineChange);

    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(roomId) ?? undefined;
    const members = useParticipatingMembers(call);

    return {
        room,
        isVoice,
        isRing,
        otherUserId,
        members,
        otherCallIsOngoing,
        videoToggle,
        setVideoToggle,
        onJoin,
        onExpand,
        onDecline,
        dismiss,
    };
}
