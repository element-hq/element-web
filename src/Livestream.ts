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

import { ClientWidgetApi } from "matrix-widget-api";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

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
