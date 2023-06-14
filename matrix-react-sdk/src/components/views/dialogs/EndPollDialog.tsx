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
import { PollEndEvent } from "matrix-js-sdk/src/extensible_events_v1/PollEndEvent";

import { _t } from "../../../languageHandler";
import QuestionDialog from "./QuestionDialog";
import { findTopAnswer } from "../messages/MPollBody";
import Modal from "../../../Modal";
import ErrorDialog from "./ErrorDialog";
import { GetRelationsForEvent } from "../rooms/EventTile";

interface IProps {
    matrixClient: MatrixClient;
    event: MatrixEvent;
    onFinished: (success?: boolean) => void;
    getRelationsForEvent?: GetRelationsForEvent;
}

export default class EndPollDialog extends React.Component<IProps> {
    private onFinished = async (endPoll: boolean): Promise<void> => {
        if (endPoll) {
            const room = this.props.matrixClient.getRoom(this.props.event.getRoomId());
            const poll = room?.polls.get(this.props.event.getId()!);

            if (!poll) {
                throw new Error("No poll instance found in room.");
            }

            try {
                const responses = await poll.getResponses();
                const topAnswer = findTopAnswer(this.props.event, responses);

                const message =
                    topAnswer === ""
                        ? _t("The poll has ended. No votes were cast.")
                        : _t("The poll has ended. Top answer: %(topAnswer)s", { topAnswer });

                const endEvent = PollEndEvent.from(this.props.event.getId()!, message).serialize();

                await this.props.matrixClient.sendEvent(this.props.event.getRoomId()!, endEvent.type, endEvent.content);
            } catch (e) {
                console.error("Failed to submit poll response event:", e);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Failed to end poll"),
                    description: _t("Sorry, the poll did not end. Please try again."),
                });
            }
        }
        this.props.onFinished(endPoll);
    };

    public render(): React.ReactNode {
        return (
            <QuestionDialog
                title={_t("End Poll")}
                description={_t(
                    "Are you sure you want to end this poll? " +
                        "This will show the final results of the poll and " +
                        "stop people from being able to vote.",
                )}
                button={_t("End Poll")}
                onFinished={(endPoll: boolean) => this.onFinished(endPoll)}
            />
        );
    }
}
