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

import React, { useContext, useEffect, useState } from "react";
import { MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastRecordingBody,
    shouldDisplayAsVoiceBroadcastRecordingTile,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastInfoState,
} from "..";
import { IBodyProps } from "../../components/views/messages/IBodyProps";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { RelationsHelper, RelationsHelperEvent } from "../../events/RelationsHelper";
import { SDKContext } from "../../contexts/SDKContext";

export const VoiceBroadcastBody: React.FC<IBodyProps> = ({ mxEvent }) => {
    const sdkContext = useContext(SDKContext);
    const client = MatrixClientPeg.get();
    const [infoState, setInfoState] = useState(mxEvent.getContent()?.state || VoiceBroadcastInfoState.Stopped);

    useEffect(() => {
        const onInfoEvent = (event: MatrixEvent): void => {
            if (event.getContent()?.state === VoiceBroadcastInfoState.Stopped) {
                // only a stopped event can change the tile state
                setInfoState(VoiceBroadcastInfoState.Stopped);
            }
        };

        const relationsHelper = new RelationsHelper(
            mxEvent,
            RelationType.Reference,
            VoiceBroadcastInfoEventType,
            client,
        );
        relationsHelper.on(RelationsHelperEvent.Add, onInfoEvent);
        relationsHelper.emitCurrent();

        return () => {
            relationsHelper.destroy();
        };
    });

    if (shouldDisplayAsVoiceBroadcastRecordingTile(infoState, client, mxEvent)) {
        const recording = sdkContext.voiceBroadcastRecordingsStore.getByInfoEvent(mxEvent, client);
        return <VoiceBroadcastRecordingBody recording={recording} />;
    }

    const playback = sdkContext.voiceBroadcastPlaybacksStore.getByInfoEvent(mxEvent, client);
    return <VoiceBroadcastPlaybackBody playback={playback} />;
};
