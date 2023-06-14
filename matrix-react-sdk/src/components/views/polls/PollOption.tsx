/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import classNames from "classnames";
import { PollAnswerSubevent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";

import { _t } from "../../../languageHandler";
import { Icon as TrophyIcon } from "../../../../res/img/element-icons/trophy.svg";
import StyledRadioButton from "../elements/StyledRadioButton";

type PollOptionContentProps = {
    answer: PollAnswerSubevent;
    voteCount: number;
    displayVoteCount?: boolean;
    isWinner?: boolean;
};
const PollOptionContent: React.FC<PollOptionContentProps> = ({ isWinner, answer, voteCount, displayVoteCount }) => {
    const votesText = displayVoteCount ? _t("%(count)s votes", { count: voteCount }) : "";
    return (
        <div className="mx_PollOption_content">
            <div className="mx_PollOption_optionText">{answer.text}</div>
            <div className="mx_PollOption_optionVoteCount">
                {isWinner && <TrophyIcon className="mx_PollOption_winnerIcon" />}
                {votesText}
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

const EndedPollOption: React.FC<Omit<PollOptionProps, "voteCount" | "totalVoteCount">> = ({
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

const ActivePollOption: React.FC<Omit<PollOptionProps, "voteCount" | "totalVoteCount">> = ({
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
    voteCount,
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
    const answerPercent = totalVoteCount === 0 ? 0 : Math.round((100.0 * voteCount) / totalVoteCount);
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
                    voteCount={voteCount}
                    displayVoteCount={displayVoteCount}
                />
            </PollOptionWrapper>
            <div className="mx_PollOption_popularityBackground">
                <div className="mx_PollOption_popularityAmount" style={{ width: `${answerPercent}%` }} />
            </div>
        </div>
    );
};
