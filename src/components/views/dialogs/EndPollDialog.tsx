/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, type MatrixClient, type TimelineEvents } from "matrix-js-sdk/src/matrix";
import { PollEndEvent } from "matrix-js-sdk/src/extensible_events_v1/PollEndEvent";

import { _t } from "../../../languageHandler";
import QuestionDialog from "./QuestionDialog";
import { findTopAnswer } from "../messages/MPollBody";
import Modal from "../../../Modal";
import ErrorDialog from "./ErrorDialog";
import { type GetRelationsForEvent } from "../rooms/EventTile";

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
                    topAnswer === "" ? _t("poll|end_message_no_votes") : _t("poll|end_message", { topAnswer });

                const endEvent = PollEndEvent.from(this.props.event.getId()!, message).serialize();

                await this.props.matrixClient.sendEvent(
                    this.props.event.getRoomId()!,
                    endEvent.type as keyof TimelineEvents,
                    endEvent.content as TimelineEvents[keyof TimelineEvents],
                );
            } catch (e) {
                console.error("Failed to submit poll response event:", e);
                Modal.createDialog(ErrorDialog, {
                    title: _t("poll|error_ending_title"),
                    description: _t("poll|error_ending_description"),
                });
            }
        }
        this.props.onFinished(endPoll);
    };

    public render(): React.ReactNode {
        return (
            <QuestionDialog
                title={_t("poll|end_title")}
                description={_t("poll|end_description")}
                button={_t("poll|end_title")}
                onFinished={(endPoll: boolean) => this.onFinished(endPoll)}
            />
        );
    }
}
