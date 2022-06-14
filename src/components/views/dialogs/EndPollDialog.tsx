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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { PollEndEvent } from "matrix-events-sdk";

import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import QuestionDialog from "./QuestionDialog";
import { findTopAnswer } from "../messages/MPollBody";
import Modal from "../../../Modal";
import ErrorDialog from "./ErrorDialog";

interface IProps extends IDialogProps {
    matrixClient: MatrixClient;
    event: MatrixEvent;
    onFinished: (success: boolean) => void;
    getRelationsForEvent?: (
        eventId: string,
        relationType: string,
        eventType: string
    ) => Relations;
}

export default class EndPollDialog extends React.Component<IProps> {
    private onFinished = (endPoll: boolean) => {
        const topAnswer = findTopAnswer(
            this.props.event,
            this.props.matrixClient,
            this.props.getRelationsForEvent,
        );

        const message = (
            (topAnswer === "")
                ? _t("The poll has ended. No votes were cast.")
                : _t(
                    "The poll has ended. Top answer: %(topAnswer)s",
                    { topAnswer },
                )
        );

        if (endPoll) {
            const endEvent = PollEndEvent.from(this.props.event.getId(), message).serialize();

            this.props.matrixClient.sendEvent(
                this.props.event.getRoomId(), endEvent.type, endEvent.content,
            ).catch((e: any) => {
                console.error("Failed to submit poll response event:", e);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Failed to end poll"),
                    description: _t(
                        "Sorry, the poll did not end. Please try again."),
                });
            });
        }
        this.props.onFinished(endPoll);
    };

    render() {
        return (
            <QuestionDialog
                title={_t("End Poll")}
                description={
                    _t(
                        "Are you sure you want to end this poll? " +
                        "This will show the final results of the poll and " +
                        "stop people from being able to vote.",
                    )
                }
                button={_t("End Poll")}
                onFinished={(endPoll: boolean) => this.onFinished(endPoll)}
            />
        );
    }
}
