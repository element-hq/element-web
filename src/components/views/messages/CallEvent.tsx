/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef, useCallback, useContext, useMemo } from "react";

import type { MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { ConnectionState, type ElementCall } from "../../../models/Call";
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
import AccessibleButton, { type AccessibleButtonKind, type ButtonEvent } from "../elements/AccessibleButton";
import MemberAvatar from "../avatars/MemberAvatar";
import { LiveContentSummary, LiveContentType } from "../rooms/LiveContentSummary";
import FacePile from "../elements/FacePile";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { CallDuration, SessionDuration } from "../voip/CallDuration";

const MAX_FACES = 8;

interface ActiveCallEventProps {
    mxEvent: MatrixEvent;
    call: ElementCall | null;
    participatingMembers: RoomMember[];
    buttonText: string;
    buttonKind: AccessibleButtonKind;
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
                        size="24px"
                    />
                    <div className="mx_CallEvent_columns">
                        <div className="mx_CallEvent_details">
                            <span className="mx_CallEvent_title">
                                {_t("timeline|m.call|video_call_started_text", { name: senderName })}
                            </span>
                            <LiveContentSummary
                                type={LiveContentType.Video}
                                text={_t("voip|video_call")}
                                active={false}
                                participantCount={participatingMembers.length}
                            />
                            <FacePile members={facePileMembers} size="24px" overflow={facePileOverflow} />
                        </div>
                        {call && <SessionDuration session={call.session} />}
                        <AccessibleButton
                            className="mx_CallEvent_button"
                            kind={buttonKind}
                            disabled={onButtonClick === null || buttonDisabledTooltip !== undefined}
                            onClick={onButtonClick}
                            title={buttonDisabledTooltip}
                        >
                            {buttonText}
                        </AccessibleButton>
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

    const [buttonText, buttonKind, onButtonClick] = useMemo<
        [string, AccessibleButtonKind, null | ((ev: ButtonEvent) => void)]
    >(() => {
        switch (connectionState) {
            case ConnectionState.Disconnected:
                return [_t("action|join"), "primary", connect];
            case ConnectionState.Connected:
                return [_t("action|leave"), "danger", disconnect];
            case ConnectionState.Disconnecting:
                return [_t("action|leave"), "danger", null];
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
                        <span className="mx_CallEvent_title">{_t("timeline|m.call|video_call_ended")}</span>
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
                buttonText={_t("action|join")}
                buttonKind="primary"
                onButtonClick={null}
            />
        );
    }

    return <ActiveLoadedCallEvent mxEvent={mxEvent} call={call as ElementCall} ref={ref} />;
});
