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

import React, { forwardRef, useCallback, useContext, useMemo } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { Call, ConnectionState } from "../../../models/Call";
import { _t } from "../../../languageHandler";
import {
    useCall,
    useConnectionState,
    useJoinCallButtonDisabled,
    useJoinCallButtonTooltip,
    useParticipants,
} from "../../../hooks/useCall";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import type { ButtonEvent } from "../elements/AccessibleButton";
import MemberAvatar from "../avatars/MemberAvatar";
import { LiveContentSummary, LiveContentType } from "../rooms/LiveContentSummary";
import FacePile from "../elements/FacePile";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { CallDuration, CallDurationFromEvent } from "../voip/CallDuration";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

const MAX_FACES = 8;

interface ActiveCallEventProps {
    mxEvent: MatrixEvent;
    participants: Set<RoomMember>;
    buttonText: string;
    buttonKind: string;
    buttonTooltip?: string;
    buttonDisabled?: boolean;
    onButtonClick: ((ev: ButtonEvent) => void) | null;
}

const ActiveCallEvent = forwardRef<any, ActiveCallEventProps>(
    (
        {
            mxEvent,
            participants,
            buttonText,
            buttonKind,
            buttonDisabled,
            buttonTooltip,
            onButtonClick,
        },
        ref,
    ) => {
        const senderName = useMemo(() => mxEvent.sender?.name ?? mxEvent.getSender(), [mxEvent]);

        const facePileMembers = useMemo(() => [...participants].slice(0, MAX_FACES), [participants]);
        const facePileOverflow = participants.size > facePileMembers.length;

        return <div className="mx_CallEvent_wrapper" ref={ref}>
            <div className="mx_CallEvent mx_CallEvent_active">
                <MemberAvatar
                    member={mxEvent.sender}
                    fallbackUserId={mxEvent.getSender()}
                    viewUserOnClick
                    width={24}
                    height={24}
                />
                <div className="mx_CallEvent_infoRows">
                    <span className="mx_CallEvent_title">
                        { _t("%(name)s started a video call", { name: senderName }) }
                    </span>
                    <LiveContentSummary
                        type={LiveContentType.Video}
                        text={_t("Video call")}
                        active={false}
                        participantCount={participants.size}
                    />
                    <FacePile members={facePileMembers} faceSize={24} overflow={facePileOverflow} />
                </div>
                <CallDurationFromEvent mxEvent={mxEvent} />
                <AccessibleTooltipButton
                    className="mx_CallEvent_button"
                    kind={buttonKind}
                    disabled={onButtonClick === null || buttonDisabled}
                    onClick={onButtonClick}
                    tooltip={buttonTooltip}
                >
                    { buttonText }
                </AccessibleTooltipButton>
            </div>
        </div>;
    },
);

interface ActiveLoadedCallEventProps {
    mxEvent: MatrixEvent;
    call: Call;
}

const ActiveLoadedCallEvent = forwardRef<any, ActiveLoadedCallEventProps>(({ mxEvent, call }, ref) => {
    const connectionState = useConnectionState(call);
    const participants = useParticipants(call);
    const joinCallButtonTooltip = useJoinCallButtonTooltip(call);
    const joinCallButtonDisabled = useJoinCallButtonDisabled(call);

    const connect = useCallback((ev: ButtonEvent) => {
        ev.preventDefault();
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: mxEvent.getRoomId()!,
            view_call: true,
            metricsTrigger: undefined,
        });
    }, [mxEvent]);

    const disconnect = useCallback((ev: ButtonEvent) => {
        ev.preventDefault();
        call.disconnect();
    }, [call]);

    const [buttonText, buttonKind, onButtonClick] = useMemo(() => {
        switch (connectionState) {
            case ConnectionState.Disconnected: return [_t("Join"), "primary", connect];
            case ConnectionState.Connecting: return [_t("Join"), "primary", null];
            case ConnectionState.Connected: return [_t("Leave"), "danger", disconnect];
            case ConnectionState.Disconnecting: return [_t("Leave"), "danger", null];
        }
    }, [connectionState, connect, disconnect]);

    return <ActiveCallEvent
        ref={ref}
        mxEvent={mxEvent}
        participants={participants}
        buttonText={buttonText}
        buttonKind={buttonKind}
        buttonDisabled={joinCallButtonDisabled}
        buttonTooltip={joinCallButtonTooltip}
        onButtonClick={onButtonClick}
    />;
});

interface CallEventProps {
    mxEvent: MatrixEvent;
}

/**
 * An event tile representing an active or historical Element call.
 */
export const CallEvent = forwardRef<any, CallEventProps>(({ mxEvent }, ref) => {
    const noParticipants = useMemo(() => new Set<RoomMember>(), []);
    const client = useContext(MatrixClientContext);
    const call = useCall(mxEvent.getRoomId()!);
    const latestEvent = client.getRoom(mxEvent.getRoomId())!.currentState
        .getStateEvents(mxEvent.getType(), mxEvent.getStateKey()!);

    if ("m.terminated" in latestEvent.getContent()) {
        // The call is terminated
        return <div className="mx_CallEvent_wrapper" ref={ref}>
            <div className="mx_CallEvent mx_CallEvent_inactive">
                <span className="mx_CallEvent_title">{ _t("Video call ended") }</span>
                <CallDuration delta={latestEvent.getTs() - mxEvent.getTs()} />
            </div>
        </div>;
    }

    if (call === null) {
        // There should be a call, but it hasn't loaded yet
        return <ActiveCallEvent
            ref={ref}
            mxEvent={mxEvent}
            participants={noParticipants}
            buttonText={_t("Join")}
            buttonKind="primary"
            onButtonClick={null}
        />;
    }

    return <ActiveLoadedCallEvent mxEvent={mxEvent} call={call} ref={ref} />;
});
