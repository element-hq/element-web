/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ClientWidgetApi } from "matrix-widget-api";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "./SdkConfig";
import { ElementWidgetActions } from "./stores/widgets/ElementWidgetActions";

export function getConfigLivestreamUrl(): string | undefined {
    return SdkConfig.get("audio_stream_url");
}

// Dummy rtmp URL used to signal that we want a special audio-only stream
const AUDIOSTREAM_DUMMY_URL = "rtmp://audiostream.dummy/";

async function createLiveStream(matrixClient: MatrixClient, roomId: string): Promise<void> {
    const openIdToken = await matrixClient.getOpenIdToken();

    const url = getConfigLivestreamUrl() + "/createStream";

    const response = await window.fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            room_id: roomId,
            openid_token: openIdToken,
        }),
    });

    const respBody = await response.json();
    return respBody["stream_id"];
}

export async function startJitsiAudioLivestream(
    matrixClient: MatrixClient,
    widgetMessaging: ClientWidgetApi,
    roomId: string,
): Promise<void> {
    const streamId = await createLiveStream(matrixClient, roomId);

    await widgetMessaging.transport.send(ElementWidgetActions.StartLiveStream, {
        rtmpStreamKey: AUDIOSTREAM_DUMMY_URL + streamId,
    });
}
