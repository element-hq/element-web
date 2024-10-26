/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { PollAnswerSubevent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import React, { ReactNode, useContext } from "react";

import { Icon as TrophyIcon } from "../../../../res/img/element-icons/trophy.svg";
import RoomContext from "../../../contexts/RoomContext";
import { useRoomMembers } from "../../../hooks/useRoomMembers";
import { _t } from "../../../languageHandler";
import FacePile from "../elements/FacePile";
import StyledRadioButton from "../elements/StyledRadioButton";
import { UserVote } from "../messages/MPollBody";

const MAXIMUM_MEMBERS_FOR_FACE_PILE = 5;

type PollOptionContentProps = {
    answer: PollAnswerSubevent;
    votes: UserVote[];
    displayVoteCount?: boolean;
    isWinner?: boolean;
};
const PollOptionContent: React.FC<PollOptionContentProps> = ({ isWinner, answer, votes, displayVoteCount }) => {
    const votesText = displayVoteCount ? _t("timeline|m.poll|count_of_votes", { count: votes.length }) : "";
    const room = useContext(RoomContext).room!;
    const members = useRoomMembers(room);

    return (
        <div className="mx_PollOption_content">
            <div className="mx_PollOption_optionText">{answer.text}</div>
            <div className="mx_PollOption_optionVoteCount">
                <div style={{ display: "flex" }}>
                    {displayVoteCount
                        && members.length <= MAXIMUM_MEMBERS_FOR_FACE_PILE
                        && <FacePile
                            members={members.filter((m) => votes.some((v) => v.sender === m.userId))}
                            size="24px"
                            overflow={false}
                            style={{ marginRight: "10px" }}
                        />
                    }
                    <span>
                        {isWinner && <TrophyIcon className="mx_PollOption_winnerIcon" />}
                        {votesText}
                    </span>
                </div>
            </div>
        </div>
    );
};

interface PollOptionProps extends PollOptionContentProps {
    pollId: string;
    totalVoteCount: number;
    isEnded?: boolean;
    isChecked?: boolean;
    onOptionSelected?: (id: string) => void;
    children?: ReactNode;
}

const EndedPollOption: React.FC<Omit<PollOptionProps, "votes" | "totalVoteCount">> = ({
    isChecked,
    children,
    answer,
}) => (
    <div
        className={classNames("mx_PollOption_endedOption", {
            mx_PollOption_endedOptionWinner: isChecked,
        })}
        data-value={answer.id}
    >
        {children}
    </div>
);

const ActivePollOption: React.FC<Omit<PollOptionProps, "votes" | "totalVoteCount">> = ({
    pollId,
    isChecked,
    children,
    answer,
    onOptionSelected,
}) => (
    <StyledRadioButton
        className="mx_PollOption_live-option"
        name={`poll_answer_select-${pollId}`}
        value={answer.id}
        checked={isChecked}
        onChange={() => onOptionSelected?.(answer.id)}
    >
        {children}
    </StyledRadioButton>
);

export const PollOption: React.FC<PollOptionProps> = ({
    pollId,
    answer,
    votes: voteCount,
    totalVoteCount,
    displayVoteCount,
    isEnded,
    isChecked,
    onOptionSelected,
}) => {
    const cls = classNames({
        mx_PollOption: true,
        mx_PollOption_checked: isChecked,
        mx_PollOption_ended: isEnded,
    });
    const isWinner = isEnded && isChecked;
    const answerPercent = totalVoteCount === 0 ? 0 : Math.round((100.0 * voteCount.length) / totalVoteCount);
    const PollOptionWrapper = isEnded ? EndedPollOption : ActivePollOption;
    return (
        <div data-testid={`pollOption-${answer.id}`} className={cls} onClick={() => onOptionSelected?.(answer.id)}>
            <PollOptionWrapper
                pollId={pollId}
                answer={answer}
                isChecked={isChecked}
                onOptionSelected={onOptionSelected}
            >
                <PollOptionContent
                    isWinner={isWinner}
                    answer={answer}
                    votes={voteCount}
                    displayVoteCount={displayVoteCount}
                />
            </PollOptionWrapper>
            <div className="mx_PollOption_popularityBackground">
                <div className="mx_PollOption_popularityAmount" style={{ width: `${answerPercent}%` }} />
            </div>
        </div>
    );
};
