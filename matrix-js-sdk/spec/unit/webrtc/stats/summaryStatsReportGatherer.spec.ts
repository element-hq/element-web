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
import { SummaryStatsReportGatherer } from "../../../../src/webrtc/stats/summaryStatsReportGatherer";
import { StatsReportEmitter } from "../../../../src/webrtc/stats/statsReportEmitter";
import { groupCallParticipantsFourOtherDevices } from "../../../test-utils/webrtc";

describe("SummaryStatsReportGatherer", () => {
    let reporter: SummaryStatsReportGatherer;
    let emitter: StatsReportEmitter;
    beforeEach(() => {
        emitter = new StatsReportEmitter();
        emitter.emitSummaryStatsReport = jest.fn();
        reporter = new SummaryStatsReportGatherer(emitter);
    });

    describe("build Summary Stats Report", () => {
        it("should do nothing if  summary list empty", async () => {
            reporter.build([]);
            expect(emitter.emitSummaryStatsReport).not.toHaveBeenCalled();
        });
        it("should do nothing if a summary stats element collection the is first time", async () => {
            reporter.build([
                {
                    isFirstCollection: true,
                    receivedMedia: 10,
                    receivedAudioMedia: 4,
                    receivedVideoMedia: 6,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 100,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ]);
            expect(emitter.emitSummaryStatsReport).not.toHaveBeenCalled();
        });

        it("should trigger new summary report", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 10,
                    receivedAudioMedia: 4,
                    receivedVideoMedia: 6,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 100,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 13,
                    receivedAudioMedia: 0,
                    receivedVideoMedia: 13,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 5,
                        totalAudio: 100,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 0,
                    receivedAudioMedia: 0,
                    receivedVideoMedia: 0,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 10,
                        totalAudio: 100,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 15,
                    receivedAudioMedia: 6,
                    receivedVideoMedia: 9,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 100,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 0.5,
                percentageReceivedAudioMedia: 0.5,
                percentageReceivedVideoMedia: 0.75,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 4,
                percentageConcealedAudio: 0.0375,
            });
        });

        it("as received video Media, although video was not received, but because video muted", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 10,
                    receivedAudioMedia: 10,
                    receivedVideoMedia: 0,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 1,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("as received no video Media, because only on video was muted", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 10,
                    receivedAudioMedia: 10,
                    receivedVideoMedia: 0,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 2,
                        muted: 1,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 0,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 0,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("as received no audio Media, although audio not received and audio muted", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 100,
                    receivedAudioMedia: 0,
                    receivedVideoMedia: 100,
                    audioTrackSummary: {
                        count: 1,
                        muted: 1,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 0,
                percentageReceivedAudioMedia: 0,
                percentageReceivedVideoMedia: 1,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("should find max jitter and max packet loss", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 20,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 40,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 20,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
            });
        });

        it("as received video Media, if no audio track received should count as received Media", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 10,
                    receivedAudioMedia: 0,
                    receivedVideoMedia: 10,
                    audioTrackSummary: {
                        count: 0,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("as received audio Media, if no video track received should count as received Media", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 22,
                    receivedVideoMedia: 0,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 0,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("as received no media at all, as received Media", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 0,
                    receivedAudioMedia: 0,
                    receivedVideoMedia: 0,
                    audioTrackSummary: {
                        count: 0,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 0,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 0,
                maxPacketLoss: 0,
                peerConnections: 1,
                percentageConcealedAudio: 0,
            });
        });

        it("should filter the first time summery stats", async () => {
            const summary = [
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: true,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 20,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 40,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
            });
        });
        it("should report missing peer connections", async () => {
            const summary = [
                {
                    isFirstCollection: true,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 20,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 0,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
                {
                    isFirstCollection: false,
                    receivedMedia: 1,
                    receivedAudioMedia: 1,
                    receivedVideoMedia: 1,
                    audioTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 2,
                        maxPacketLoss: 5,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                    videoTrackSummary: {
                        count: 1,
                        muted: 0,
                        maxJitter: 0,
                        maxPacketLoss: 40,
                        concealedAudio: 0,
                        totalAudio: 0,
                    },
                },
            ];
            reporter.build(summary);
            expect(emitter.emitSummaryStatsReport).toHaveBeenCalledWith({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 2,
                percentageConcealedAudio: 0,
            });
        });
    });
    describe("extend Summary Stats Report", () => {
        it("should extend the report with the appropriate data based on a user map", async () => {
            const summary = {
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
            };
            SummaryStatsReportGatherer.extendSummaryReport(summary, groupCallParticipantsFourOtherDevices);
            expect(summary).toStrictEqual({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
                opponentUsersInCall: 1,
                opponentDevicesInCall: 4,
                diffDevicesToPeerConnections: 0,
                ratioPeerConnectionToDevices: 1,
            });
        });
        it("should extend the report data based on a user map", async () => {
            const summary = {
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
            };
            SummaryStatsReportGatherer.extendSummaryReport(summary, new Map());
            expect(summary).toStrictEqual({
                percentageReceivedMedia: 1,
                percentageReceivedAudioMedia: 1,
                percentageReceivedVideoMedia: 1,
                maxJitter: 2,
                maxPacketLoss: 40,
                peerConnections: 4,
                percentageConcealedAudio: 0,
                opponentUsersInCall: 0,
                opponentDevicesInCall: 0,
                diffDevicesToPeerConnections: -4,
                ratioPeerConnectionToDevices: 0,
            });
        });
    });
});
