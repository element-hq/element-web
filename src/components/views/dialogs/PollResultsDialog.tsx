/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { PollAnswerSubevent, PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
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

export default function PollResultsDialog(props: IProps): JSX.Element {
    return (
        <BaseDialog
            title={props.pollEvent.question.text}
            onFinished={() => Modal.closeCurrentModal()}
        >
            {
                props.pollEvent.answers.map((answer) => {
                    const votes = props.votes.get(answer.id) || [];
                    if (votes.length === 0) return;

                    return <AnswerEntry
                        key={answer.id}
                        answer={answer}
                        members={props.members}
                        votes={votes}
                    />;
                })
            }
        </BaseDialog>
    );
}

function AnswerEntry(props: {
    answer: PollAnswerSubevent;
    members: RoomMember[];
    votes: UserVote[];
}): JSX.Element {
    const { answer, members, votes } = props;
    return (
        <div key={answer.id} className="mx_AnswerEntry">
            <div className="mx_AnswerEntry_Header">
                <span className="mx_AnswerEntry_Header_answerName">{answer.text}</span>
                <span>{votes.length} votes</span>
            </div>
            {votes.length === 0 && <div>No one voted for this.</div>}
            {votes.map((vote) => {
                const member = members.find(m => m.userId === vote.sender);
                if (member) return <VoterEntry
                    key={vote.sender}
                    vote={vote}
                    member={member}
                />;
            })}
        </div>
    );
}

function VoterEntry(props: { vote: UserVote; member: RoomMember }): JSX.Element {
    const { vote, member } = props;
    return <div key={vote.sender} className="mx_VoterEntry">
        <div className="mx_VoterEntry_AvatarWrapper">
            <MemberAvatar member={member} size="36px" aria-hidden="true" />
        </div>
        {member.name}
    </div>;
}
