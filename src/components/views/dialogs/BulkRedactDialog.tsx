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

import React, { useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { Room } from "matrix-js-sdk/src/models/room";
import { EventTimeline } from "matrix-js-sdk/src/models/event-timeline";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseDialog from "../dialogs/BaseDialog";
import InfoDialog from "../dialogs/InfoDialog";
import DialogButtons from "../elements/DialogButtons";
import StyledCheckbox from "../elements/StyledCheckbox";

interface Props {
    matrixClient: MatrixClient;
    room: Room;
    member: RoomMember;
    onFinished(redact?: boolean): void;
}

const BulkRedactDialog: React.FC<Props> = (props) => {
    const { matrixClient: cli, room, member, onFinished } = props;
    const [keepStateEvents, setKeepStateEvents] = useState(true);

    let timeline: EventTimeline | null = room.getLiveTimeline();
    let eventsToRedact: MatrixEvent[] = [];
    while (timeline) {
        eventsToRedact = [
            ...eventsToRedact,
            ...timeline.getEvents().filter(
                (event) =>
                    event.getSender() === member.userId &&
                    !event.isRedacted() &&
                    !event.isRedaction() &&
                    event.getType() !== EventType.RoomCreate &&
                    // Don't redact ACLs because that'll obliterate the room
                    // See https://github.com/matrix-org/synapse/issues/4042 for details.
                    event.getType() !== EventType.RoomServerAcl &&
                    // Redacting encryption events is equally bad
                    event.getType() !== EventType.RoomEncryption,
            ),
        ];
        timeline = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS);
    }

    if (eventsToRedact.length === 0) {
        return (
            <InfoDialog
                onFinished={onFinished}
                title={_t("No recent messages by %(user)s found", { user: member.name })}
                description={
                    <div>
                        <p>{_t("Try scrolling up in the timeline to see if there are any earlier ones.")}</p>
                    </div>
                }
            />
        );
    } else {
        eventsToRedact = eventsToRedact.filter((event) => !(keepStateEvents && event.isState()));
        const count = eventsToRedact.length;
        const user = member.name;

        const redact = async (): Promise<void> => {
            logger.info(`Started redacting recent ${count} messages for ${member.userId} in ${room.roomId}`);
            dis.dispatch({
                action: Action.BulkRedactStart,
                room_id: room.roomId,
            });

            // Submitting a large number of redactions freezes the UI,
            // so first yield to allow to rerender after closing the dialog.
            await Promise.resolve();
            await Promise.all(
                eventsToRedact.reverse().map(async (event): Promise<void> => {
                    try {
                        await cli.redactEvent(room.roomId, event.getId()!);
                    } catch (err) {
                        // log and swallow errors
                        logger.error("Could not redact", event.getId());
                        logger.error(err);
                    }
                }),
            );

            logger.info(`Finished redacting recent ${count} messages for ${member.userId} in ${room.roomId}`);
            dis.dispatch({
                action: Action.BulkRedactEnd,
                room_id: room.roomId,
            });
        };

        return (
            <BaseDialog
                className="mx_BulkRedactDialog"
                onFinished={onFinished}
                title={_t("Remove recent messages by %(user)s", { user })}
                contentId="mx_Dialog_content"
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    <p>
                        {_t(
                            "You are about to remove %(count)s messages by %(user)s. " +
                                "This will remove them permanently for everyone in the conversation. " +
                                "Do you wish to continue?",
                            { count, user },
                        )}
                    </p>
                    <p>
                        {_t(
                            "For a large amount of messages, this might take some time. " +
                                "Please don't refresh your client in the meantime.",
                        )}
                    </p>
                    <StyledCheckbox checked={keepStateEvents} onChange={(e) => setKeepStateEvents(e.target.checked)}>
                        {_t("Preserve system messages")}
                    </StyledCheckbox>
                    <div className="mx_BulkRedactDialog_checkboxMicrocopy">
                        {_t(
                            "Uncheck if you also want to remove system messages on this user " +
                                "(e.g. membership change, profile change…)",
                        )}
                    </div>
                </div>
                <DialogButtons
                    primaryButton={_t("Remove %(count)s messages", { count })}
                    primaryButtonClass="danger"
                    primaryDisabled={count === 0}
                    onPrimaryButtonClick={() => {
                        setImmediate(redact);
                        onFinished(true);
                    }}
                    onCancel={() => onFinished(false)}
                />
            </BaseDialog>
        );
    }
};

export default BulkRedactDialog;
