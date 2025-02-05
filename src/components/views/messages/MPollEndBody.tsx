/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState, useContext, type ForwardRefExoticComponent } from "react";
import { MatrixEvent, M_TEXT } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { Icon as PollIcon } from "../../../../res/img/element-icons/room/composer/poll.svg";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import { textForEvent } from "../../../TextForEvent";
import { Caption } from "../typography/Caption";
import { type IBodyProps } from "./IBodyProps";
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
        const pollEndFallbackMessage = M_TEXT.findIn<string>(mxEvent.getContent()) || textForEvent(mxEvent, cli);
        return (
            <>
                <PollIcon className="mx_MPollEndBody_icon" />
                {!isLoadingPollStartEvent && pollEndFallbackMessage}
            </>
        );
    }

    return (
        <div className="mx_MPollEndBody" ref={ref}>
            <Caption>{_t("timeline|m.poll.end|ended")}</Caption>
            <MPollBody mxEvent={pollStartEvent} {...props} />
        </div>
    );
}) as ForwardRefExoticComponent<IBodyProps>;
