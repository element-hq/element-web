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

import React from "react";
import { Poll } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import dispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../utils/MediaEventHelper";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";
import MPollBody from "../../messages/MPollBody";

interface Props {
    poll: Poll;
    requestModalClose: () => void;
    permalinkCreator: RoomPermalinkCreator;
}

const NOOP = (): void => {};

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
                onHeightChanged={NOOP}
                onMessageAllowed={NOOP}
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
                    {_t("View poll in timeline")}
                </AccessibleButton>
            </div>
        </>
    );
};
