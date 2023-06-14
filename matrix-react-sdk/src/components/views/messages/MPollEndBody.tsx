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

import React, { useEffect, useState, useContext } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";
import { logger } from "matrix-js-sdk/src/logger";

import { Icon as PollIcon } from "../../../../res/img/element-icons/room/composer/poll.svg";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import { textForEvent } from "../../../TextForEvent";
import { Caption } from "../typography/Caption";
import { IBodyProps } from "./IBodyProps";
import MPollBody from "./MPollBody";

const getRelatedPollStartEventId = (event: MatrixEvent): string | undefined => {
    const relation = event.getRelation();
    return relation?.event_id;
};

/**
 * Attempt to retrieve the related poll start event for this end event
 * If the event already exists in the rooms timeline, return it
 * Otherwise try to fetch the event from the server
 * @param event
 * @returns
 */
const usePollStartEvent = (event: MatrixEvent): { pollStartEvent?: MatrixEvent; isLoadingPollStartEvent: boolean } => {
    const matrixClient = useContext(MatrixClientContext);
    const [pollStartEvent, setPollStartEvent] = useState<MatrixEvent>();
    const [isLoadingPollStartEvent, setIsLoadingPollStartEvent] = useState(false);

    const pollStartEventId = getRelatedPollStartEventId(event);

    useEffect(() => {
        const room = matrixClient.getRoom(event.getRoomId());
        const fetchPollStartEvent = async (roomId: string, pollStartEventId: string): Promise<void> => {
            setIsLoadingPollStartEvent(true);
            try {
                const startEventJson = await matrixClient.fetchRoomEvent(roomId, pollStartEventId);
                const startEvent = new MatrixEvent(startEventJson);
                // add the poll to the room polls state
                room?.processPollEvents([startEvent, event]);

                // end event is not a valid end to the related start event
                // if not sent by the same user
                if (startEvent.getSender() === event.getSender()) {
                    setPollStartEvent(startEvent);
                }
            } catch (error) {
                logger.error("Failed to fetch related poll start event", error);
            } finally {
                setIsLoadingPollStartEvent(false);
            }
        };

        if (pollStartEvent || !room || !pollStartEventId) {
            return;
        }

        const timelineSet = room.getUnfilteredTimelineSet();
        const localEvent = timelineSet
            ?.getTimelineForEvent(pollStartEventId)
            ?.getEvents()
            .find((e) => e.getId() === pollStartEventId);

        if (localEvent) {
            // end event is not a valid end to the related start event
            // if not sent by the same user
            if (localEvent.getSender() === event.getSender()) {
                setPollStartEvent(localEvent);
            }
        } else {
            // pollStartEvent is not in the current timeline,
            // fetch it
            fetchPollStartEvent(room.roomId, pollStartEventId);
        }
    }, [event, pollStartEventId, pollStartEvent, matrixClient]);

    return { pollStartEvent, isLoadingPollStartEvent };
};

export const MPollEndBody = React.forwardRef<any, IBodyProps>(({ mxEvent, ...props }, ref) => {
    const cli = useMatrixClientContext();
    const { pollStartEvent, isLoadingPollStartEvent } = usePollStartEvent(mxEvent);

    if (!pollStartEvent) {
        const pollEndFallbackMessage = M_TEXT.findIn(mxEvent.getContent()) || textForEvent(mxEvent, cli);
        return (
            <>
                <PollIcon className="mx_MPollEndBody_icon" />
                {!isLoadingPollStartEvent && pollEndFallbackMessage}
            </>
        );
    }

    return (
        <div>
            <Caption>{_t("Ended a poll")}</Caption>
            <MPollBody mxEvent={pollStartEvent} {...props} />
        </div>
    );
});
