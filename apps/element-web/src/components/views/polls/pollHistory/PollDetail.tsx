/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Poll } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import dispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type MediaEventHelper } from "../../../../utils/MediaEventHelper";
import AccessibleButton, { type ButtonEvent } from "../../elements/AccessibleButton";
import MPollBody from "../../messages/MPollBody";

interface Props {
    poll: Poll;
    requestModalClose: () => void;
    permalinkCreator: RoomPermalinkCreator;
}

/**
 * Content of PollHistory when a specific poll is selected
 */
export const PollDetail: React.FC<Props> = ({ poll, permalinkCreator, requestModalClose }) => {
    // link to end event for ended polls
    const eventIdToLinkTo = poll.isEnded ? poll.endEventId! : poll.pollId;
    const linkToTimeline = permalinkCreator.forEvent(eventIdToLinkTo);

    const onLinkClick = (e: ButtonEvent): void => {
        if ((e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey) {
            // native behavior for link on ctrl/cmd + click
            return;
        }
        // otherwise handle navigation in the app
        e.preventDefault();
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: eventIdToLinkTo,
            highlighted: true,
            room_id: poll.roomId,
            metricsTrigger: undefined, // room doesn't change
        });

        requestModalClose();
    };
    return (
        <>
            <MPollBody
                mxEvent={poll.rootEvent}
                permalinkCreator={permalinkCreator}
                // MPollBody doesn't use this
                // and MessageEvent only defines it for eligible events
                // should be fixed on IBodyProps types
                // cheat to fulfil the type here
                mediaEventHelper={{} as unknown as MediaEventHelper}
            />
            <br />
            <div>
                <AccessibleButton
                    kind="link_inline"
                    element="a"
                    href={linkToTimeline}
                    onClick={onLinkClick}
                    rel="noreferrer noopener"
                >
                    {_t("right_panel|poll|view_in_timeline")}
                </AccessibleButton>
            </div>
        </>
    );
};
