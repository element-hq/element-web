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
import { ConnectionState, ElementCall } from "../../../models/Call";
import { _t } from "../../../languageHandler";
import {
    useCall,
    useConnectionState,
    useJoinCallButtonDisabledTooltip,
    useParticipatingMembers,
} from "../../../hooks/useCall";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import type { ButtonEvent } from "../elements/AccessibleButton";
import MemberAvatar from "../avatars/MemberAvatar";
import { LiveContentSummary, LiveContentType } from "../rooms/LiveContentSummary";
import FacePile from "../elements/FacePile";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { CallDuration, GroupCallDuration } from "../voip/CallDuration";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

const MAX_FACES = 8;

interface ActiveCallEventProps {
    mxEvent: MatrixEvent;
    call: ElementCall | null;
    participatingMembers: RoomMember[];
    buttonText: string;
    buttonKind: string;
    buttonDisabledTooltip?: string;
    onButtonClick: ((ev: ButtonEvent) => void) | null;
}

const ActiveCallEvent = forwardRef<any, ActiveCallEventProps>(
    ({ mxEvent, call, participatingMembers, buttonText, buttonKind, buttonDisabledTooltip, onButtonClick }, ref) => {
        const senderName = useMemo(() => mxEvent.sender?.name ?? mxEvent.getSender(), [mxEvent]);

        const facePileMembers = useMemo(() => participatingMembers.slice(0, MAX_FACES), [participatingMembers]);
        const facePileOverflow = participatingMembers.length > facePileMembers.length;

        return (
            <div className="mx_CallEvent_wrapper" ref={ref}>
                <div className="mx_CallEvent mx_CallEvent_active">
                    <MemberAvatar
                        member={mxEvent.sender}
                        fallbackUserId={mxEvent.getSender()}
                        viewUserOnClick
                        width={24}
                        height={24}
                    />
                    <div className="mx_CallEvent_columns">
                        <div className="mx_CallEvent_details">
                            <span className="mx_CallEvent_title">
                                {_t("%(name)s started a video call", { name: senderName })}
                            </span>
                            <LiveContentSummary
                                type={LiveContentType.Video}
                                text={_t("Video call")}
                                active={false}
                                participantCount={participatingMembers.length}
                            />
                            <FacePile members={facePileMembers} faceSize={24} overflow={facePileOverflow} />
                        </div>
                        {call && <GroupCallDuration groupCall={call.groupCall} />}
                        <AccessibleTooltipButton
                            className="mx_CallEvent_button"
                            kind={buttonKind}
                            disabled={onButtonClick === null || buttonDisabledTooltip !== undefined}
                            onClick={onButtonClick}
                            tooltip={buttonDisabledTooltip}
                        >
                            {buttonText}
                        </AccessibleTooltipButton>
                    </div>
                </div>
            </div>
        );
    },
);

interface ActiveLoadedCallEventProps {
    mxEvent: MatrixEvent;
    call: ElementCall;
}

const ActiveLoadedCallEvent = forwardRef<any, ActiveLoadedCallEventProps>(({ mxEvent, call }, ref) => {
    const connectionState = useConnectionState(call);
    const participatingMembers = useParticipatingMembers(call);
    const joinCallButtonDisabledTooltip = useJoinCallButtonDisabledTooltip(call);

    const connect = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: mxEvent.getRoomId()!,
                view_call: true,
                metricsTrigger: undefined,
            });
        },
        [mxEvent],
    );

    const disconnect = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            call.disconnect();
        },
        [call],
    );

    const [buttonText, buttonKind, onButtonClick] = useMemo(() => {
        switch (connectionState) {
            case ConnectionState.Disconnected:
                return [_t("Join"), "primary", connect];
            case ConnectionState.Connecting:
                return [_t("Join"), "primary", null];
            case ConnectionState.Connected:
                return [_t("Leave"), "danger", disconnect];
            case ConnectionState.Disconnecting:
                return [_t("Leave"), "danger", null];
        }
    }, [connectionState, connect, disconnect]);

    return (
        <ActiveCallEvent
            ref={ref}
            mxEvent={mxEvent}
            call={call}
            participatingMembers={participatingMembers}
            buttonText={buttonText}
            buttonKind={buttonKind}
            buttonDisabledTooltip={joinCallButtonDisabledTooltip ?? undefined}
            onButtonClick={onButtonClick}
        />
    );
});

interface CallEventProps {
    mxEvent: MatrixEvent;
}

/**
 * An event tile representing an active or historical Element call.
 */
export const CallEvent = forwardRef<any, CallEventProps>(({ mxEvent }, ref) => {
    const client = useContext(MatrixClientContext);
    const call = useCall(mxEvent.getRoomId()!);
    const latestEvent = client
        .getRoom(mxEvent.getRoomId())!
        .currentState.getStateEvents(mxEvent.getType(), mxEvent.getStateKey()!)!;

    if ("m.terminated" in latestEvent.getContent() || latestEvent.isRedacted()) {
        // The call is terminated
        return (
            <div className="mx_CallEvent_wrapper" ref={ref}>
                <div className="mx_CallEvent mx_CallEvent_inactive">
                    <div className="mx_CallEvent_columns">
                        <span className="mx_CallEvent_title">{_t("Video call ended")}</span>
                        <CallDuration delta={latestEvent.getTs() - mxEvent.getTs()} />
                    </div>
                </div>
            </div>
        );
    }

    if (call === null) {
        // There should be a call, but it hasn't loaded yet
        return (
            <ActiveCallEvent
                ref={ref}
                mxEvent={mxEvent}
                call={null}
                participatingMembers={[]}
                buttonText={_t("Join")}
                buttonKind="primary"
                onButtonClick={null}
            />
        );
    }

    return <ActiveLoadedCallEvent mxEvent={mxEvent} call={call as ElementCall} ref={ref} />;
});
