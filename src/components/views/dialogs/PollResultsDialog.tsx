/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import React from "react";

import Modal from "../../../Modal";
import MemberAvatar from "../avatars/MemberAvatar";
import { UserVote } from "../messages/MPollBody";
import BaseDialog from "./BaseDialog";

interface IProps {
    pollEvent: PollStartEvent;
    votes: Map<string, UserVote[]>;
    members: RoomMember[];
}

export default function PollResultsDialog (props: IProps): JSX.Element {
    return (
        <BaseDialog
            title={props.pollEvent.question.text}
            onFinished={() => Modal.closeCurrentModal()}
        >
            {
                props.pollEvent.answers.map((answer, answerIndex) => {
                    const votes = props.votes.get(answer.id) || [];

                    if(votes.length === 0) return;

                    return (
                        <div key={answer.id}>
                            <div style={{display: "flex", alignItems: "center", marginBottom: "10px"}}>
                                <span style={{fontWeight: "bolder", flexGrow: 1}}>{answer.text}</span>
                                <span>{votes.length} votes</span>
                            </div>
                            {votes.length === 0 && <div>No one voted for this.</div>}
                            {votes.map((vote) => {
                                const member = props.members.find(m => m.userId === vote.sender);
                                if (!member) return null;
                                return <div key={vote.sender} style={{display: "flex", alignItems: "center", marginLeft: "15px"}}>
                                    <div style={{marginRight: "10px"}}>
                                        <MemberAvatar member={member} size="36px" aria-hidden="true" />
                                    </div>
                                    {member.name}
                                </div>;
                            })}
                            {answerIndex < props.pollEvent.answers.length - 1 && <br />}
                        </div>
                    );
                })
            }
        </BaseDialog>
    );
}
