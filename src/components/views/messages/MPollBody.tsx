/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IBodyProps } from "./IBodyProps";
import { IPollAnswer, IPollContent, POLL_START_EVENT_TYPE } from '../../../polls/consts';
import StyledRadioButton from '../elements/StyledRadioButton';

// TODO: [andyb] Use extensible events library when ready
const TEXT_NODE_TYPE = "org.matrix.msc1767.text";

interface IState {
    selected?: string;
}

@replaceableComponent("views.messages.MPollBody")
export default class MPollBody extends React.Component<IBodyProps, IState> {
    constructor(props: IBodyProps) {
        super(props);

        this.state = {
            selected: null,
        };
    }

    private selectOption(answerId: string) {
        this.setState({ selected: answerId });
    }

    private onOptionSelected = (e: React.FormEvent<HTMLInputElement>): void => {
        this.selectOption(e.currentTarget.value);
    };

    render() {
        const pollStart: IPollContent =
            this.props.mxEvent.getContent()[POLL_START_EVENT_TYPE.name];
        const pollId = this.props.mxEvent.getId();

        return <div className="mx_MPollBody">
            <h2>{ pollStart.question[TEXT_NODE_TYPE] }</h2>
            <div className="mx_MPollBody_allOptions">
                {
                    pollStart.answers.map((answer: IPollAnswer) => {
                        const checked = this.state.selected === answer.id;
                        const classNames = `mx_MPollBody_option${
                            checked ? " mx_MPollBody_option_checked": ""
                        }`;
                        return <div
                            key={answer.id}
                            className={classNames}
                            onClick={() => this.selectOption(answer.id)}
                        >
                            <StyledRadioButton
                                name={`poll_answer_select-${pollId}`}
                                value={answer.id}
                                checked={this.state.selected === answer.id}
                                onChange={this.onOptionSelected}
                            >
                                <div className="mx_MPollBody_optionVoteCount">
                                    { _t("%(number)s votes", { number: 0 }) }
                                </div>
                                <div className="mx_MPollBody_optionText">
                                    { answer[TEXT_NODE_TYPE] }
                                </div>
                            </StyledRadioButton>
                            <div className="mx_MPollBody_popularityBackground">
                                <div className="mx_MPollBody_popularityAmount" />
                            </div>
                        </div>;
                    })
                }
            </div>
            <div className="mx_MPollBody_totalVotes">
                { _t( "Based on %(total)s votes", { total: 0 } ) }
            </div>
        </div>;
    }
}
