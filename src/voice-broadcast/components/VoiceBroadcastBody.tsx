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

import {
    VoiceBroadcastRecordingBody,
    VoiceBroadcastRecordingsStore,
    shouldDisplayAsVoiceBroadcastRecordingTile,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastInfoState,
} from "..";
import { IBodyProps } from "../../components/views/messages/IBodyProps";
import { MatrixClientPeg } from "../../MatrixClientPeg";

export const VoiceBroadcastBody: React.FC<IBodyProps> = ({ mxEvent }) => {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(mxEvent.getRoomId());
    const relations = room?.getUnfilteredTimelineSet()?.relations?.getChildEventsForEvent(
        mxEvent.getId(),
        RelationType.Reference,
        VoiceBroadcastInfoEventType,
    );
    const relatedEvents = relations?.getRelations();
    const state = !relatedEvents?.find((event: MatrixEvent) => {
        return event.getContent()?.state === VoiceBroadcastInfoState.Stopped;
    }) ? VoiceBroadcastInfoState.Started : VoiceBroadcastInfoState.Stopped;

    if (shouldDisplayAsVoiceBroadcastRecordingTile(state, client, mxEvent)) {
        const recording = VoiceBroadcastRecordingsStore.instance().getByInfoEvent(mxEvent, client);
        return <VoiceBroadcastRecordingBody
            recording={recording}
        />;
    }

    const playback = VoiceBroadcastPlaybacksStore.instance().getByInfoEvent(mxEvent);
    return <VoiceBroadcastPlaybackBody
        playback={playback}
    />;
};
