/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, createRef } from "react";
import {
    type Room,
    type MatrixEvent,
    type KnownPollKind,
    M_POLL_KIND_DISCLOSED,
    M_POLL_KIND_UNDISCLOSED,
    M_POLL_START,
    type IPartialEvent,
    type TimelineEvents,
} from "matrix-js-sdk/src/matrix";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";

import ScrollableBaseModal, { type IScrollableBaseState } from "../dialogs/ScrollableBaseModal";
import QuestionDialog from "../dialogs/QuestionDialog";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { arrayFastClone, arraySeed } from "../../../utils/arrays";
import Field from "./Field";
import AccessibleButton from "./AccessibleButton";
import Spinner from "./Spinner";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";

interface IProps {
    room: Room;
    threadId?: string;
    editingMxEvent?: MatrixEvent; // Truthy if we are editing an existing poll
    onFinished(pollCreated?: boolean): void;
}

enum FocusTarget {
    Topic,
    NewOption,
}
interface IState extends IScrollableBaseState {
    question: string;
    options: string[];
    busy: boolean;
    kind: KnownPollKind;
    autoFocusTarget: FocusTarget;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;
const DEFAULT_NUM_OPTIONS = 2;
const MAX_QUESTION_LENGTH = 340;
const MAX_OPTION_LENGTH = 340;

function creatingInitialState(): IState {
    return {
        title: _t("poll|create_poll_title"),
        actionLabel: _t("poll|create_poll_action"),
        canSubmit: false, // need to add a question and at least one option first
        question: "",
        options: arraySeed("", DEFAULT_NUM_OPTIONS),
        busy: false,
        kind: M_POLL_KIND_DISCLOSED,
        autoFocusTarget: FocusTarget.Topic,
    };
}

function editingInitialState(editingMxEvent: MatrixEvent): IState {
    const poll = editingMxEvent.unstableExtensibleEvent as PollStartEvent;
    if (!poll?.isEquivalentTo(M_POLL_START)) return creatingInitialState();

    return {
        title: _t("poll|edit_poll_title"),
        actionLabel: _t("action|done"),
        canSubmit: true,
        question: poll.question.text,
        options: poll.answers.map((ans) => ans.text),
        busy: false,
        kind: poll.kind,
        autoFocusTarget: FocusTarget.Topic,
    };
}

export default class PollCreateDialog extends ScrollableBaseModal<IProps, IState> {
    private addOptionRef = createRef<HTMLDivElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = props.editingMxEvent ? editingInitialState(props.editingMxEvent) : creatingInitialState();
    }

    private checkCanSubmit(): void {
        this.setState({
            canSubmit:
                !this.state.busy &&
                this.state.question.trim().length > 0 &&
                this.state.options.filter((op) => op.trim().length > 0).length >= MIN_OPTIONS,
        });
    }

    private onQuestionChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ question: e.target.value }, () => this.checkCanSubmit());
    };

    private onOptionChange = (i: number, e: ChangeEvent<HTMLInputElement>): void => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions[i] = e.target.value;
        this.setState({ options: newOptions }, () => this.checkCanSubmit());
    };

    private onOptionRemove = (i: number): void => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions.splice(i, 1);
        this.setState({ options: newOptions }, () => this.checkCanSubmit());
    };

    private onOptionAdd = (): void => {
        const newOptions = arrayFastClone(this.state.options);
        newOptions.push("");
        this.setState({ options: newOptions, autoFocusTarget: FocusTarget.NewOption }, () => {
            // Scroll the button into view after the state update to ensure we don't experience
            // a pop-in effect, and to avoid the button getting cut off due to a mid-scroll render.
            this.addOptionRef.current?.scrollIntoView?.();
        });
    };

    private createEvent(): IPartialEvent<object> {
        const pollStart = PollStartEvent.from(
            this.state.question.trim(),
            this.state.options.map((a) => a.trim()).filter((a) => !!a),
            this.state.kind.name,
        ).serialize();

        if (!this.props.editingMxEvent) {
            return pollStart;
        } else {
            return {
                content: {
                    "m.new_content": pollStart.content,
                    "m.relates_to": {
                        rel_type: "m.replace",
                        event_id: this.props.editingMxEvent.getId(),
                    },
                },
                type: pollStart.type,
            };
        }
    }

    protected submit(): void {
        this.setState({ busy: true, canSubmit: false });
        const pollEvent = this.createEvent();
        doMaybeLocalRoomAction(
            this.props.room.roomId,
            (actualRoomId: string) =>
                this.matrixClient.sendEvent(
                    actualRoomId,
                    this.props.threadId ?? null,
                    pollEvent.type as keyof TimelineEvents,
                    pollEvent.content as TimelineEvents[keyof TimelineEvents],
                ),
            this.matrixClient,
        )
            .then(() => this.props.onFinished(true))
            .catch((e) => {
                console.error("Failed to post poll:", e);
                Modal.createDialog(QuestionDialog, {
                    title: _t("poll|failed_send_poll_title"),
                    description: _t("poll|failed_send_poll_description"),
                    button: _t("action|try_again"),
                    cancelButton: _t("action|cancel"),
                    onFinished: (tryAgain: boolean) => {
                        if (!tryAgain) {
                            this.cancel();
                        } else {
                            this.setState({ busy: false, canSubmit: true });
                        }
                    },
                });
            });
    }

    protected cancel(): void {
        this.props.onFinished(false);
    }

    protected renderContent(): React.ReactNode {
        return (
            <div className="mx_PollCreateDialog">
                <h2>{_t("poll|type_heading")}</h2>
                <Field element="select" value={this.state.kind.name} onChange={this.onPollTypeChange}>
                    <option key={M_POLL_KIND_DISCLOSED.name} value={M_POLL_KIND_DISCLOSED.name}>
                        {_t("poll|type_open")}
                    </option>
                    <option key={M_POLL_KIND_UNDISCLOSED.name} value={M_POLL_KIND_UNDISCLOSED.name}>
                        {_t("poll|type_closed")}
                    </option>
                </Field>
                <p>{pollTypeNotes(this.state.kind)}</p>
                <h2>{_t("poll|topic_heading")}</h2>
                <Field
                    id="poll-topic-input"
                    value={this.state.question}
                    maxLength={MAX_QUESTION_LENGTH}
                    label={_t("poll|topic_label")}
                    placeholder={_t("poll|topic_placeholder")}
                    onChange={this.onQuestionChange}
                    usePlaceholderAsHint={true}
                    disabled={this.state.busy}
                    autoFocus={this.state.autoFocusTarget === FocusTarget.Topic}
                />
                <h2>{_t("poll|options_heading")}</h2>
                {this.state.options.map((op, i) => (
                    <div key={`option_${i}`} className="mx_PollCreateDialog_option">
                        <Field
                            id={`pollcreate_option_${i}`}
                            value={op}
                            maxLength={MAX_OPTION_LENGTH}
                            label={_t("poll|options_label", { number: i + 1 })}
                            placeholder={_t("poll|options_placeholder")}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => this.onOptionChange(i, e)}
                            usePlaceholderAsHint={true}
                            disabled={this.state.busy}
                            autoFocus={
                                this.state.autoFocusTarget === FocusTarget.NewOption &&
                                i === this.state.options.length - 1
                            }
                        />
                        <AccessibleButton
                            onClick={() => this.onOptionRemove(i)}
                            className="mx_PollCreateDialog_removeOption"
                            disabled={this.state.busy}
                        />
                    </div>
                ))}
                <AccessibleButton
                    onClick={this.onOptionAdd}
                    disabled={this.state.busy || this.state.options.length >= MAX_OPTIONS}
                    kind="secondary"
                    className="mx_PollCreateDialog_addOption"
                    ref={this.addOptionRef}
                >
                    {_t("poll|options_add_button")}
                </AccessibleButton>
                {this.state.busy && (
                    <div className="mx_PollCreateDialog_busy">
                        <Spinner />
                    </div>
                )}
            </div>
        );
    }

    public onPollTypeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        this.setState({
            kind: M_POLL_KIND_DISCLOSED.matches(e.target.value) ? M_POLL_KIND_DISCLOSED : M_POLL_KIND_UNDISCLOSED,
        });
    };
}

function pollTypeNotes(kind: KnownPollKind): string {
    if (M_POLL_KIND_DISCLOSED.matches(kind.name)) {
        return _t("poll|disclosed_notes");
    } else {
        return _t("poll|notes");
    }
}
