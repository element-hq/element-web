/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
import { RelationsHelper, RelationsHelperEvent } from "../../events/RelationsHelper";
import { SDKContext } from "../../contexts/SDKContext";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";

export const VoiceBroadcastBody: React.FC<IBodyProps> = ({ mxEvent }) => {
    const sdkContext = useContext(SDKContext);
    const client = useMatrixClientContext();
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
