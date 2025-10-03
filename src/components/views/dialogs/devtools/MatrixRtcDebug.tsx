/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext, useEffect, useMemo, useState } from "react";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { _t, _td } from "../../../../languageHandler.tsx";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool.tsx";
import { useTypedEventEmitter, useTypedEventEmitterState } from "../../../../hooks/useEventEmitter.ts";
import { MatrixRTCSessionManagerEvents } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSessionManager.ts";
import { CallMembership, MatrixRTCSession, MatrixRTCSessionEvent } from "matrix-js-sdk/src/matrixrtc/index.ts";
import { Badge } from "@vector-im/compound-web";
import { useCall } from "../../../../hooks/useCall.ts";
import { ElementCall } from "../../../../models/Call.ts";

function MatrixRTCSessionInfo({
    session,
    active,
    call,
}: {
    session: MatrixRTCSession;
    active: boolean;
    call?: ElementCall;
}): JSX.Element {
    const memberships = useTypedEventEmitterState(
        session,
        MatrixRTCSessionEvent.MembershipsChanged,
        (_old, newMembership) => (newMembership ? newMembership : session.memberships),
    ) as CallMembership[];
    const latestChange = useTypedEventEmitterState(
        session,
        MatrixRTCSessionEvent.MembershipsChanged,
        (_old, newMembership) => (newMembership ? { members: newMembership, changeTs: new Date() } : undefined),
    ) as { members: CallMembership[]; changeTs: Date } | undefined;

    // Re-check when memberships change.
    const focus = useMemo(() => session.getActiveFocus(), [memberships]);
    return (
        <section>
            <h3>
                {session.sessionDescription.application} {session.callId}{" "}
                <Badge kind={active ? "green" : "grey"}>
                    {active ? _t("devtools|matrix_rtc|session_active") : _t("devtools|matrix_rtc|session_ended")}
                </Badge>
            </h3>
            {latestChange && (
                <p>{`${latestChange.members.map((m) => m.membershipID).join(", ")} ${latestChange.changeTs.toTimeString()}`}</p>
            )}
            <p>
                {_t("devtools|matrix_rtc|call_intent")}: {session.getConsensusCallIntent() ?? "mixed"}
            </p>
            {focus && (
                <details>
                    <summary>{_t("devtools|matrix_rtc|active_focus")}</summary>
                    <pre>{JSON.stringify(focus, undefined, 2)}</pre>
                </details>
            )}
            {memberships.length === 0 ? (
                <p>No members connected.</p>
            ) : (
                <>
                    <p>{_t("common|n_members", { count: memberships.length })}:</p>
                    <ul>
                        {memberships.map((member) => (
                            <li>
                                <code>
                                    {member.sender} {member.deviceId}
                                </code>
                                {member.isExpired() && "(expired)"}{" "}
                                <details>
                                    <summary>Inspect</summary>
                                    <pre>{JSON.stringify(member, undefined, 2)}</pre>
                                </details>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {call && (
                <>
                    <h4>{_t("voip|element_call")}</h4>
                    <p>
                        {_t("devtools|matrix_rtc|connection_state")}: {call.connectionState}
                    </p>
                    {call.participants.size === 0 ? (
                        <p>No call participants.</p>
                    ) : (
                        <>
                            <p>{_t("devtools|matrix_rtc|participants")}:</p>
                            <ul>
                                {[...call.participants.entries()].map(([roomMember, deviceIds]) => (
                                    <li>
                                        {roomMember.userId} {[...deviceIds].join(", ")}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    <details>
                        <summary>Widget Params</summary>
                        <pre>{JSON.stringify(call.widgetGenerationParameters, undefined, 2)}</pre>
                    </details>
                </>
            )}
        </section>
    );
}

export default function MatrixRtcDebug({ onBack }: IDevtoolsProps): JSX.Element {
    const context = useContext(DevtoolsContext);
    const client = useMatrixClientContext();
    const call = useCall(context.room.roomId);
    let [sessions, setSession] = useState<{ session: MatrixRTCSession; active: boolean; start: Date }[]>([]);
    useTypedEventEmitter(
        client.matrixRTC,
        MatrixRTCSessionManagerEvents.SessionStarted,
        (roomId: string, sesh: MatrixRTCSession) => {
            if (context.room.roomId !== roomId) {
                return;
            }
            console.log(roomId, sesh);
            setSession((sessions) => [...sessions, { session: sesh, active: true, start: new Date() }]);
        },
    );
    useTypedEventEmitter(
        client.matrixRTC,
        MatrixRTCSessionManagerEvents.SessionEnded,
        (roomId: string, sesh: MatrixRTCSession) => {
            if (context.room.roomId !== roomId) {
                return;
            }
            const existingSessionData = sessions.find((s) => s.session === sesh);
            if (!existingSessionData) {
                return;
            }
            setSession((sessions) => [
                ...sessions.filter((s) => s.session !== sesh),
                { ...existingSessionData, active: false },
            ]);
        },
    );

    useEffect(() => {
        const existingSession = client.matrixRTC.getActiveRoomSession(context.room);
        if (existingSession) {
            setSession([{ session: existingSession, active: true, start: new Date() }]);
        }
    }, []);

    return (
        <BaseTool onBack={onBack}>
            {sessions.length === 0 ? (
                <p>{_t("devtools|matrix_rtc|no_active_sessions")}</p>
            ) : (
                sessions.map((s) => (
                    <MatrixRTCSessionInfo
                        {...s}
                        call={(call as ElementCall)?.session === s.session ? (call as ElementCall) : undefined}
                        key={s.start.toString()}
                    />
                ))
            )}
        </BaseTool>
    );
}
