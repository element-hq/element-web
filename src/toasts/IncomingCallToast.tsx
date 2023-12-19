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

import React, { useCallback, useEffect, useMemo } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
// eslint-disable-next-line no-restricted-imports
import { MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSessionManager";
// eslint-disable-next-line no-restricted-imports
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";

import { _t } from "../languageHandler";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { MatrixClientPeg } from "../MatrixClientPeg";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import ToastStore from "../stores/ToastStore";
import AccessibleTooltipButton from "../components/views/elements/AccessibleTooltipButton";
import {
    LiveContentSummary,
    LiveContentSummaryWithCall,
    LiveContentType,
} from "../components/views/rooms/LiveContentSummary";
import { useCall, useJoinCallButtonDisabledTooltip } from "../hooks/useCall";
import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { useDispatcher } from "../hooks/useDispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { Call } from "../models/Call";
import { AudioID } from "../LegacyCallHandler";
import { useTypedEventEmitter } from "../hooks/useEventEmitter";

export const getIncomingCallToastKey = (callId: string, roomId: string): string => `call_${callId}_${roomId}`;
const MAX_RING_TIME_MS = 10 * 1000;

interface JoinCallButtonWithCallProps {
    onClick: (e: ButtonEvent) => void;
    call: Call;
}

function JoinCallButtonWithCall({ onClick, call }: JoinCallButtonWithCallProps): JSX.Element {
    const disabledTooltip = useJoinCallButtonDisabledTooltip(call);

    return (
        <AccessibleTooltipButton
            className="mx_IncomingCallToast_joinButton"
            onClick={onClick}
            disabled={disabledTooltip !== null}
            tooltip={disabledTooltip ?? undefined}
            kind="primary"
        >
            {_t("action|join")}
        </AccessibleTooltipButton>
    );
}

interface Props {
    notifyEvent: MatrixEvent;
}

export function IncomingCallToast({ notifyEvent }: Props): JSX.Element {
    const roomId = notifyEvent.getRoomId()!;
    const room = MatrixClientPeg.safeGet().getRoom(roomId) ?? undefined;
    const call = useCall(roomId);
    const audio = useMemo(() => document.getElementById(AudioID.Ring) as HTMLMediaElement, []);

    // Start ringing if not already.
    useEffect(() => {
        const isRingToast = (notifyEvent.getContent() as unknown as { notify_type: string })["notify_type"] == "ring";
        if (isRingToast && audio.paused) {
            audio.play();
        }
    }, [audio, notifyEvent]);

    // Stop ringing on dismiss.
    const dismissToast = useCallback((): void => {
        ToastStore.sharedInstance().dismissToast(
            getIncomingCallToastKey(notifyEvent.getContent().call_id ?? "", roomId),
        );
        audio.pause();
    }, [audio, notifyEvent, roomId]);

    // Dismiss if session got ended remotely.
    const onSessionEnded = useCallback(
        (endedSessionRoomId: string, session: MatrixRTCSession): void => {
            if (roomId == endedSessionRoomId && session.callId == notifyEvent.getContent().call_id) {
                dismissToast();
            }
        },
        [dismissToast, notifyEvent, roomId],
    );

    // Dismiss on timeout.
    useEffect(() => {
        const timeout = setTimeout(dismissToast, MAX_RING_TIME_MS);
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

    // Dismiss on clicking join.
    const onJoinClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();

            // The toast will be automatically dismissed by the dispatcher callback above
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room?.roomId,
                view_call: true,
                metricsTrigger: undefined,
            });
        },
        [room],
    );

    // Dismiss on closing toast.
    const onCloseClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();

            dismissToast();
        },
        [dismissToast],
    );

    useTypedEventEmitter(
        MatrixClientPeg.safeGet().matrixRTC,
        MatrixRTCSessionManagerEvents.SessionEnded,
        onSessionEnded,
    );

    return (
        <React.Fragment>
            <div>
                <RoomAvatar room={room ?? undefined} size="24px" />
            </div>
            <div className="mx_IncomingCallToast_content">
                <div className="mx_IncomingCallToast_info">
                    <span className="mx_IncomingCallToast_room">
                        {room ? room.name : _t("voip|call_toast_unknown_room")}
                    </span>
                    <div className="mx_IncomingCallToast_message">{_t("voip|video_call_started")}</div>
                    {call ? (
                        <LiveContentSummaryWithCall call={call} />
                    ) : (
                        <LiveContentSummary
                            type={LiveContentType.Video}
                            text={_t("common|video")}
                            active={false}
                            participantCount={0}
                        />
                    )}
                </div>
                {call ? (
                    <JoinCallButtonWithCall onClick={onJoinClick} call={call} />
                ) : (
                    <AccessibleTooltipButton
                        className="mx_IncomingCallToast_joinButton"
                        onClick={onJoinClick}
                        kind="primary"
                    >
                        {_t("action|join")}
                    </AccessibleTooltipButton>
                )}
            </div>
            <AccessibleTooltipButton
                className="mx_IncomingCallToast_closeButton"
                onClick={onCloseClick}
                title={_t("action|close")}
            />
        </React.Fragment>
    );
}
