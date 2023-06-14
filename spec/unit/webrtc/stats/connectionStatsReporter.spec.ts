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
import { ConnectionStatsBuilder } from "../../../../src/webrtc/stats/connectionStatsBuilder";

describe("ConnectionStatsReporter", () => {
    describe("should on bandwidth stats", () => {
        it("build bandwidth report if chromium starts attributes available", () => {
            const stats = {
                availableIncomingBitrate: 1000,
                availableOutgoingBitrate: 2000,
            } as RTCIceCandidatePairStats;
            expect(ConnectionStatsBuilder.buildBandwidthReport(stats)).toEqual({ download: 1, upload: 2 });
        });
        it("build empty bandwidth report if chromium starts attributes not available", () => {
            const stats = {} as RTCIceCandidatePairStats;
            expect(ConnectionStatsBuilder.buildBandwidthReport(stats)).toEqual({ download: 0, upload: 0 });
        });
    });

    describe("should on connection stats", () => {
        it("build bandwidth report if chromium starts attributes available", () => {
            const stats = {
                availableIncomingBitrate: 1000,
                availableOutgoingBitrate: 2000,
            } as RTCIceCandidatePairStats;
            expect(ConnectionStatsBuilder.buildBandwidthReport(stats)).toEqual({ download: 1, upload: 2 });
        });
        it("build empty bandwidth report if chromium starts attributes not available", () => {
            const stats = {} as RTCIceCandidatePairStats;
            expect(ConnectionStatsBuilder.buildBandwidthReport(stats)).toEqual({ download: 0, upload: 0 });
        });
    });
});
