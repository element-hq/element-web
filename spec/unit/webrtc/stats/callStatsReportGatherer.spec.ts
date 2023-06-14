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

import { CallStatsReportGatherer } from "../../../../src/webrtc/stats/callStatsReportGatherer";
import { StatsReportEmitter } from "../../../../src/webrtc/stats/statsReportEmitter";
import { MediaSsrcHandler } from "../../../../src/webrtc/stats/media/mediaSsrcHandler";
import { currentChromeReport, prevChromeReport } from "../../../test-utils/webrtcReports";
import { MockRTCPeerConnection } from "../../../test-utils/webrtc";

const CALL_ID = "CALL_ID";
const USER_ID = "USER_ID";

describe("CallStatsReportGatherer", () => {
    let collector: CallStatsReportGatherer;
    let rtcSpy: RTCPeerConnection;
    let emitter: StatsReportEmitter;
    beforeEach(() => {
        rtcSpy = { getStats: () => new Promise<RTCStatsReport>(() => null) } as RTCPeerConnection;
        rtcSpy.addEventListener = jest.fn();
        rtcSpy.getTransceivers = jest.fn().mockReturnValue([]);
        emitter = new StatsReportEmitter();
        collector = new CallStatsReportGatherer(CALL_ID, USER_ID, rtcSpy, emitter);
    });

    describe("on process stats", () => {
        it("if active calculate stats reports", async () => {
            const getStats = jest.spyOn(rtcSpy, "getStats");
            const report = {} as RTCStatsReport;
            report.forEach = jest.fn().mockReturnValue([]);
            getStats.mockResolvedValue(report);
            const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
            expect(getStats).toHaveBeenCalled();
            expect(actual).toEqual({
                isFirstCollection: true,
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
            });
            expect(collector.getActive()).toBeTruthy();
        });

        it("if not active do not calculate stats reports", async () => {
            collector.setActive(false);
            const getStats = jest.spyOn(rtcSpy, "getStats");
            await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
            expect(getStats).not.toHaveBeenCalled();
        });

        it("if get reports fails, the collector becomes inactive", async () => {
            expect(collector.getActive()).toBeTruthy();
            const getStats = jest.spyOn(rtcSpy, "getStats");
            getStats.mockRejectedValue(new Error("unknown"));
            await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
            expect(getStats).toHaveBeenCalled();
            expect(collector.getActive()).toBeFalsy();
        });

        it("if active and getStats returns not an RTCStatsReport inside a promise the collector fails and becomes inactive", async () => {
            const getStats = jest.spyOn(rtcSpy, "getStats");
            // @ts-ignore
            getStats.mockReturnValue({});
            const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
            expect(actual).toEqual({
                isFirstCollection: true,
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
            });
            expect(getStats).toHaveBeenCalled();
            expect(collector.getActive()).toBeFalsy();
        });

        it("if active and the collector runs not the first time the Summery Stats is marked as not fits collection", async () => {
            const getStats = jest.spyOn(rtcSpy, "getStats");
            // @ts-ignore
            collector.previousStatsReport = {} as RTCStatsReport;
            const report = {} as RTCStatsReport;
            report.forEach = jest.fn().mockReturnValue([]);
            getStats.mockResolvedValue(report);
            const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
            expect(getStats).toHaveBeenCalled();
            expect(actual).toEqual({
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
            });
            expect(collector.getActive()).toBeTruthy();
        });

        describe("should not only produce a call summary stat but also", () => {
            const wantedSummaryReport = {
                isFirstCollection: false,
                audioTrackSummary: {
                    concealedAudio: 0,
                    count: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    muted: 0,
                    totalAudio: 0,
                },
                receivedAudioMedia: 0,
                receivedMedia: 0,
                receivedVideoMedia: 0,
                videoTrackSummary: {
                    concealedAudio: 0,
                    count: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    muted: 0,
                    totalAudio: 0,
                },
            };
            beforeEach(() => {
                rtcSpy = new MockRTCPeerConnection() as unknown as RTCPeerConnection;
                collector = new CallStatsReportGatherer(CALL_ID, USER_ID, rtcSpy, emitter);
                const getStats = jest.spyOn(rtcSpy, "getStats");

                const previous = prevChromeReport as unknown as RTCStatsReport;
                previous.get = (id: string) => {
                    return prevChromeReport.find((data) => data.id === id);
                };
                // @ts-ignore
                collector.previousStatsReport = previous;

                const current = currentChromeReport as unknown as RTCStatsReport;
                current.get = (id: string) => {
                    return currentChromeReport.find((data) => data.id === id);
                };

                // @ts-ignore
                getStats.mockResolvedValue(current);
            });

            it("emit byteSentStatsReport", async () => {
                const emitByteSendReport = jest.spyOn(emitter, "emitByteSendReport");
                const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
                expect(actual).toEqual(wantedSummaryReport);
                expect(emitByteSendReport).toHaveBeenCalled();
            });
            it("emit emitConnectionStatsReport", async () => {
                const emitConnectionStatsReport = jest.spyOn(emitter, "emitConnectionStatsReport");
                const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
                expect(actual).toEqual(wantedSummaryReport);
                expect(emitConnectionStatsReport).toHaveBeenCalled();
            });
            it("emit callFeedStatsReport", async () => {
                const emitCallFeedReport = jest.spyOn(emitter, "emitCallFeedReport");
                const actual = await collector.processStats("GROUP_CALL_ID", "LOCAL_USER_ID");
                expect(actual).toEqual(wantedSummaryReport);
                expect(emitCallFeedReport).toHaveBeenCalled();
            });
        });
    });

    describe("on signal state change event", () => {
        let events: { [key: string]: any };
        beforeEach(() => {
            events = [];
            // Define the addEventListener method with a Jest mock function
            rtcSpy.addEventListener = jest.fn((event: any, callback: any) => {
                events[event] = callback;
            });

            collector = new CallStatsReportGatherer(CALL_ID, USER_ID, rtcSpy, emitter);
        });
        it("in case of stable, parse remote and local description", () => {
            // @ts-ignore
            const mediaSsrcHandler = {
                parse: jest.fn(),
                ssrcToMid: jest.fn(),
                findMidBySsrc: jest.fn(),
                getSsrcToMidMap: jest.fn(),
            } as MediaSsrcHandler;

            const remoteSDP = "sdp";
            const localSDP = "sdp";

            // @ts-ignore
            rtcSpy.signalingState = "stable";

            // @ts-ignore
            rtcSpy.currentRemoteDescription = <RTCSessionDescription>{ sdp: remoteSDP };
            // @ts-ignore
            rtcSpy.currentLocalDescription = <RTCSessionDescription>{ sdp: localSDP };

            // @ts-ignore
            collector.trackStats.mediaSsrcHandler = mediaSsrcHandler;

            events["signalingstatechange"]();
            expect(mediaSsrcHandler.parse).toHaveBeenCalledWith(remoteSDP, "remote");
            expect(mediaSsrcHandler.parse).toHaveBeenCalledWith(localSDP, "local");
        });
    });
});
