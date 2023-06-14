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
import { Bitrate } from "./media/mediaTrackStats";

export class ConnectionStatsBuilder {
    public static buildBandwidthReport(now: RTCIceCandidatePairStats): Bitrate {
        const availableIncomingBitrate = now.availableIncomingBitrate;
        const availableOutgoingBitrate = now.availableOutgoingBitrate;

        return {
            download: availableIncomingBitrate ? Math.round(availableIncomingBitrate / 1000) : 0,
            upload: availableOutgoingBitrate ? Math.round(availableOutgoingBitrate / 1000) : 0,
        };
    }
}
