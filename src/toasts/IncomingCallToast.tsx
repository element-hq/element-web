/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useState } from "react";
import { type Room, type MatrixEvent, type RoomMember, RoomEvent, EventType } from "matrix-js-sdk/src/matrix";
import { Button, ToggleInput, Tooltip, TooltipProvider } from "@vector-im/compound-web";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";
import CrossIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import { logger } from "matrix-js-sdk/src/logger";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import { _t } from "../languageHandler";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { MatrixClientPeg } from "../MatrixClientPeg";
import defaultDispatcher from "../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import ToastStore from "../stores/ToastStore";
import {
    LiveContentSummary,
    LiveContentSummaryWithCall,
    LiveContentType,
} from "../components/views/rooms/LiveContentSummary";
import { useCall, useJoinCallButtonDisabledTooltip } from "../hooks/useCall";
import AccessibleButton, { type ButtonEvent } from "../components/views/elements/AccessibleButton";
import { useDispatcher } from "../hooks/useDispatcher";
import { type ActionPayload } from "../dispatcher/payloads";
import { type Call, CallEvent } from "../models/Call";
import LegacyCallHandler, { AudioID } from "../LegacyCallHandler";
import { useEventEmitter } from "../hooks/useEventEmitter";
import { CallStore, CallStoreEvent } from "../stores/CallStore";
import { AvatarWithDetails } from "../shared-components/avatar/AvatarWithDetails";

/**
 * Get the key for the incoming call toast. A combination of the event ID and room ID.
 * @param notificationEventId The ID of the notification event.
 * @param roomId The ID of the room.
 * @returns The key for the incoming call toast.
 */
export const getIncomingCallToastKey = (notificationEventId: string, roomId: string): string =>
    `call_${notificationEventId}_${roomId}`;

/**
 * Get the ts when the notification event was sent.
 * This can be either the origin_server_ts or a ts the sender of this event claims as
 * the time they sent it (sender_ts).
 * The origin_server_ts is the fallback if sender_ts seems wrong.
 * @param event The RTCNotification event.
 * @returns The timestamp to use as the expect start time to apply the `lifetime` to.
 */
export const getNotificationEventSendTs = (event: MatrixEvent): number => {
    const content = event.getContent() as Partial<IRTCNotificationContent>;
    const sendTs = content.sender_ts;
    if (sendTs && Math.abs(sendTs - event.getTs()) >= 15000) {
        logger.warn(
            "Received RTCNotification event. With large sender_ts origin_server_ts offset -> using origin_server_ts",
        );
        return event.getTs();
    }
    return sendTs ?? event.getTs();
};
const MAX_RING_TIME_MS = 90 * 1000;

interface JoinCallButtonWithCallProps {
    onClick: (e: ButtonEvent) => void;
    call: Call | null;
    disabledTooltip: string | undefined;
}

function JoinCallButtonWithCall({ onClick, call, disabledTooltip }: JoinCallButtonWithCallProps): JSX.Element {
    let disTooltip = disabledTooltip;
    const disabledBecauseFullTooltip = useJoinCallButtonDisabledTooltip(call);
    disTooltip = disabledTooltip ?? disabledBecauseFullTooltip ?? undefined;

    return (
        <Tooltip description={disTooltip ?? _t("voip|video_call")}>
            <Button
                className="mx_IncomingCallToast_actionButton"
                onClick={onClick}
                disabled={disTooltip != undefined}
                kind="primary"
                Icon={CheckIcon}
                size="sm"
            >
                {_t("action|join")}
            </Button>
        </Tooltip>
    );
}

interface DeclineCallButtonWithNotificationEventProps {
    onDeclined: (e: ButtonEvent) => void;
    notificationEvent: MatrixEvent;
    room?: Room;
}

function DeclineCallButtonWithNotificationEvent({
    notificationEvent,
    room,
    onDeclined,
}: DeclineCallButtonWithNotificationEventProps): JSX.Element {
    const [declining, setDeclining] = useState(false);
    const onClick = useCallback(
        async (e: ButtonEvent) => {
            e.stopPropagation();
            setDeclining(true);
            await room?.client.sendRtcDecline(room.roomId, notificationEvent.getId() ?? "");
            onDeclined(e);
        },
        [notificationEvent, onDeclined, room?.client, room?.roomId],
    );
    return (
        <Tooltip description={_t("voip|decline_call")}>
            <Button
                className="mx_IncomingCallToast_actionButton"
                onClick={onClick}
                kind="primary"
                destructive
                disabled={declining}
                Icon={CrossIcon}
                size="sm"
            >
                {_t("action|decline")}
            </Button>
        </Tooltip>
    );
}

interface Props {
    notificationEvent: MatrixEvent;
}

export function IncomingCallToast({ notificationEvent }: Props): JSX.Element {
    const roomId = notificationEvent.getRoomId()!;
    // Use a partial type so ts still helps us to not miss any type checks.
    const notificationContent = notificationEvent.getContent() as Partial<IRTCNotificationContent>;
    const room = MatrixClientPeg.safeGet().getRoom(roomId) ?? undefined;
    const call = useCall(roomId);
    const [connectedCalls, setConnectedCalls] = useState<Call[]>(Array.from(CallStore.instance.connectedCalls));
    useEventEmitter(CallStore.instance, CallStoreEvent.ConnectedCalls, () => {
        setConnectedCalls(Array.from(CallStore.instance.connectedCalls));
    });
    const otherCallIsOngoing = connectedCalls.find((call) => call.roomId !== roomId);
    // Start ringing if not already.
    useEffect(() => {
        const isRingToast = notificationContent.notification_type == "ring";
        if (isRingToast && !LegacyCallHandler.instance.isPlaying(AudioID.Ring)) {
            LegacyCallHandler.instance.play(AudioID.Ring);
        }
    }, [notificationContent.notification_type]);

    // Stop ringing on dismiss.
    const dismissToast = useCallback((): void => {
        const notificationId = notificationEvent.getId();
        if (!notificationId) {
            logger.warn("Could not get eventId for RTCNotification event");
            return;
        }
        ToastStore.sharedInstance().dismissToast(getIncomingCallToastKey(notificationId, roomId));
        LegacyCallHandler.instance.pause(AudioID.Ring);
    }, [notificationEvent, roomId]);

    // Dismiss if session got ended remotely.
    const onCall = useCallback(
        (call: Call, callRoomId: string): void => {
            const roomId = notificationEvent.getRoomId();
            if (!roomId && roomId !== callRoomId) return;
            if (call === null || call.participants.size === 0) {
                dismissToast();
            }
        },
        [dismissToast, notificationEvent],
    );

    // Dismiss if session got declined remotely.
    const onTimelineChange = useCallback(
        (ev: MatrixEvent) => {
            const userId = room?.client.getUserId();
            if (
                ev.getType() === EventType.RTCDecline &&
                userId !== undefined &&
                ev.getSender() === userId && // It is our decline not someone elses
                ev.relationEventId === notificationEvent.getId() // The event declines this ringing toast.
            ) {
                dismissToast();
            }
        },
        [dismissToast, notificationEvent, room?.client],
    );

    // Dismiss if another device from this user joins.
    const onParticipantChange = useCallback(
        (participants: Map<RoomMember, Set<string>>, prevParticipants: Map<RoomMember, Set<string>>) => {
            if (Array.from(participants.keys()).some((p) => p.userId == room?.client.getUserId())) {
                dismissToast();
            }
        },
        [dismissToast, room?.client],
    );

    // Dismiss on timeout.
    useEffect(() => {
        const lifetime = notificationContent.lifetime ?? MAX_RING_TIME_MS;
        const timeout = setTimeout(dismissToast, getNotificationEventSendTs(notificationEvent) + lifetime - Date.now());
        return () => clearTimeout(timeout);
    });

    // Dismiss on viewing call.
    useDispatcher(
        defaultDispatcher,
        useCallback(
            (payload: ActionPayload) => {
                if (payload.action === Action.ViewRoom && payload.room_id === roomId && payload.view_call) {
                    dismissToast();
                }
            },
            [roomId, dismissToast],
        ),
    );

    const [skipLobbyToggle, setSkipLobbyToggle] = useState(true);

    // Dismiss on clicking join.
    // If the skip lobby option is undefined, it will use to the shift key state to decide if the lobby is skipped.
    const onJoinClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();

            // The toast will be automatically dismissed by the dispatcher callback above
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room?.roomId,
                view_call: true,
                skipLobby: skipLobbyToggle ?? ("shiftKey" in e ? e.shiftKey : false),
                metricsTrigger: undefined,
            });
        },
        [room, skipLobbyToggle],
    );

    // Dismiss on closing toast.
    const onCloseClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();

            dismissToast();
        },
        [dismissToast],
    );

    useEventEmitter(CallStore.instance, CallStoreEvent.Call, onCall);
    useEventEmitter(call ?? undefined, CallEvent.Participants, onParticipantChange);
    useEventEmitter(room, RoomEvent.Timeline, onTimelineChange);

    const callLiveContentSummary = call ? (
        <LiveContentSummaryWithCall call={call} />
    ) : (
        <LiveContentSummary
            type={LiveContentType.Video}
            text={_t("common|video")}
            active={false}
            participantCount={0}
        />
    );
    return (
        <TooltipProvider>
            <>
                <div className="mx_IncomingCallToast_content">
                    <div className="mx_IncomingCallToast_message">
                        <VideoCallIcon width="20px" height="20px" style={{ position: "relative", top: "4px" }} />{" "}
                        {_t("voip|video_call_started")}
                    </div>
                    <AvatarWithDetails
                        avatar={<RoomAvatar room={room ?? undefined} size="32px" />}
                        details={callLiveContentSummary}
                        title={room ? room.name : _t("voip|call_toast_unknown_room")}
                    />
                    <div className="mx_IncomingCallToast_toggleWithLabel">
                        <span>{_t("voip|skip_lobby_toggle_option")}</span>
                        <ToggleInput onChange={(e) => setSkipLobbyToggle(e.target.checked)} checked={skipLobbyToggle} />
                    </div>
                    <div className="mx_IncomingCallToast_buttons">
                        <DeclineCallButtonWithNotificationEvent
                            notificationEvent={notificationEvent}
                            room={room}
                            onDeclined={onCloseClick}
                        />
                        <JoinCallButtonWithCall
                            onClick={onJoinClick}
                            call={call}
                            disabledTooltip={otherCallIsOngoing ? "Ongoing call" : undefined}
                        />
                    </div>
                </div>
                <AccessibleButton
                    className="mx_IncomingCallToast_closeButton"
                    onClick={onCloseClick}
                    title={_t("action|close")}
                />
            </>
        </TooltipProvider>
    );
}
