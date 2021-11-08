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

import ScrollableBaseModal, { IScrollableBaseState } from "../dialogs/ScrollableBaseModal";
import { IDialogProps } from "../dialogs/IDialogProps";
import React, { ChangeEvent, createRef } from "react";
import { _t } from "../../../languageHandler";
import { Room } from "matrix-js-sdk/src/models/room";
import { arrayFastClone, arraySeed } from "../../../utils/arrays";
import Field from "./Field";
import AccessibleButton from "./AccessibleButton";
import { makePollContent, POLL_KIND_DISCLOSED, POLL_START_EVENT_TYPE } from "../../../polls/consts";

interface IProps extends IDialogProps {
    room: Room;
}

interface IState extends IScrollableBaseState {
    question: string;
    options: string[];
    busy: boolean;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;
const DEFAULT_NUM_OPTIONS = 2;

export default class PollCreateDialog extends ScrollableBaseModal<IProps, IState> {
    private addOptionRef = createRef<HTMLDivElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            title: _t("Create poll"),
            actionLabel: _t("Create Poll"),
            canSubmit: false, // need to add a question and at least one option first

            question: "",
            options: arraySeed("", DEFAULT_NUM_OPTIONS),
            busy: false,
        };
    }

    private checkCanSubmit() {
        this.setState({
            canSubmit:
                !this.state.busy &&
                this.state.question.trim().length > 0 &&
                this.state.options.filter(op => op.trim().length > 0).length >= MIN_OPTIONS,
        });
    }

    private onQuestionChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({ question: e.target.value }, () => this.checkCanSubmit());
    };

    private onOptionChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions[i] = e.target.value;
        this.setState({ options: newOptions }, () => this.checkCanSubmit());
    };

    private onOptionRemove = (i: number) => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions.splice(i, 1);
        this.setState({ options: newOptions }, () => this.checkCanSubmit());
    };

    private onOptionAdd = () => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions.push("");
        this.setState({ options: newOptions }, () => {
            // Scroll the button into view after the state update to ensure we don't experience
            // a pop-in effect, and to avoid the button getting cut off due to a mid-scroll render.
            this.addOptionRef.current?.scrollIntoView();
        });
    };

    protected submit(): void {
        this.setState({ busy: true, canSubmit: false });
        this.matrixClient.sendEvent(
            this.props.room.roomId,
            POLL_START_EVENT_TYPE.name,
            makePollContent(this.state.question, this.state.options, POLL_KIND_DISCLOSED.name),
        ).then(() => this.props.onFinished(true)).catch(e => {
            console.error("Failed to submit poll event:", e);
            this.setState({ busy: false, canSubmit: true });
        });
    }

    protected cancel(): void {
        this.props.onFinished(false);
    }

    protected renderContent(): React.ReactNode {
        return <div className="mx_PollCreateDialog">
            <h2>{ _t("What is your poll question or topic?") }</h2>
            <Field
                value={this.state.question}
                label={_t("Question or topic")}
                placeholder={_t("Write something...")}
                onChange={this.onQuestionChange}
                usePlaceholderAsHint={true}
            />
            <h2>{ _t("Create options") }</h2>
            {
                this.state.options.map((op, i) => <div key={`option_${i}`} className="mx_PollCreateDialog_option">
                    <Field
                        value={op}
                        label={_t("Option %(number)s", { number: i + 1 })}
                        placeholder={_t("Write an option")}
                        onChange={e => this.onOptionChange(i, e)}
                        usePlaceholderAsHint={true}
                    />
                    <AccessibleButton
                        onClick={() => this.onOptionRemove(i)}
                        className="mx_PollCreateDialog_removeOption"
                    />
                </div>)
            }
            <AccessibleButton
                onClick={this.onOptionAdd}
                disabled={this.state.options.length >= MAX_OPTIONS}
                kind="secondary"
                className="mx_PollCreateDialog_addOption"
                inputRef={this.addOptionRef}
            >{ _t("Add option") }</AccessibleButton>
        </div>;
    }
}
