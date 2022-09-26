/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState, VoiceBroadcastRecordingBody } from "..";
import { IBodyProps } from "../../components/views/messages/IBodyProps";
import { MatrixClientPeg } from "../../MatrixClientPeg";

/**
 * Temporary component to display voice broadcasts.
 * XXX: To be refactored to some fancy store/hook/controller architecture.
 */
export const VoiceBroadcastBody: React.FC<IBodyProps> = ({
    getRelationsForEvent,
    mxEvent,
}) => {
    const client = MatrixClientPeg.get();
    const relations = getRelationsForEvent?.(
        mxEvent.getId(),
        RelationType.Reference,
        VoiceBroadcastInfoEventType,
    );
    const relatedEvents = relations?.getRelations();
    const live = !relatedEvents?.find((event: MatrixEvent) => {
        return event.getContent()?.state === VoiceBroadcastInfoState.Stopped;
    });

    const stopVoiceBroadcast = () => {
        if (!live) return;

        client.sendStateEvent(
            mxEvent.getRoomId(),
            VoiceBroadcastInfoEventType,
            {
                state: VoiceBroadcastInfoState.Stopped,
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: mxEvent.getId(),
                },
            },
            client.getUserId(),
        );
    };

    const room = client.getRoom(mxEvent.getRoomId());
    const senderId = mxEvent.getSender();
    const sender = mxEvent.sender;
    return <VoiceBroadcastRecordingBody
        onClick={stopVoiceBroadcast}
        live={live}
        member={sender}
        userId={senderId}
        title={`${sender?.name ?? senderId} • ${room.name}`}
    />;
};
