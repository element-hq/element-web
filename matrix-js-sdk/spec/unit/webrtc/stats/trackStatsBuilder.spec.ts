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
import { TrackStatsBuilder } from "../../../../src/webrtc/stats/trackStatsBuilder";
import { MediaTrackStats } from "../../../../src/webrtc/stats/media/mediaTrackStats";

describe("TrackStatsBuilder", () => {
    describe("should on frame and resolution stats", () => {
        it("creating empty frame and resolution report, if no data available.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsBuilder.buildFramerateResolution(trackStats, {});
            expect(trackStats.getFramerate()).toEqual(0);
            expect(trackStats.getResolution()).toEqual({ width: -1, height: -1 });
        });
        it("creating empty frame and resolution report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildFramerateResolution(trackStats, {
                framesPerSecond: 22.2,
                frameHeight: 180,
                frameWidth: 360,
            });
            expect(trackStats.getFramerate()).toEqual(22);
            expect(trackStats.getResolution()).toEqual({ width: 360, height: 180 });
        });
    });

    describe("should on simulcast", () => {
        it("creating simulcast framerate.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsBuilder.calculateSimulcastFramerate(
                trackStats,
                {
                    framesSent: 100,
                    timestamp: 1678957001000,
                },
                {
                    framesSent: 10,
                    timestamp: 1678957000000,
                },
                3,
            );
            expect(trackStats.getFramerate()).toEqual(30);
        });
    });

    describe("should on bytes received stats", () => {
        it("creating build bitrate received report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildBitrateReceived(
                trackStats,
                {
                    bytesReceived: 2001000,
                    timestamp: 1678957010,
                },
                { bytesReceived: 2000000, timestamp: 1678957000 },
            );
            expect(trackStats.getBitrate()).toEqual({ download: 800, upload: 0 });
        });
    });

    describe("should on bytes send stats", () => {
        it("creating build bitrate send report.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsBuilder.buildBitrateSend(
                trackStats,
                {
                    bytesSent: 2001000,
                    timestamp: 1678957010,
                },
                { bytesSent: 2000000, timestamp: 1678957000 },
            );
            expect(trackStats.getBitrate()).toEqual({ download: 0, upload: 800 });
        });
    });

    describe("should on codec stats", () => {
        it("creating build bitrate send report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const remote = {} as RTCStatsReport;
            remote.get = jest.fn().mockReturnValue({ mimeType: "video/v8" });
            TrackStatsBuilder.buildCodec(remote, trackStats, { codecId: "codecID" });
            expect(trackStats.getCodec()).toEqual("v8");
        });
    });

    describe("should on package lost stats", () => {
        it("creating build package lost on send report.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsBuilder.buildPacketsLost(
                trackStats,
                {
                    type: "outbound-rtp",
                    packetsSent: 200,
                    packetsLost: 120,
                },
                {
                    packetsSent: 100,
                    packetsLost: 30,
                },
            );
            expect(trackStats.getLoss()).toEqual({ packetsTotal: 190, packetsLost: 90, isDownloadStream: false });
        });
        it("creating build package lost on received report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildPacketsLost(
                trackStats,
                {
                    type: "inbound-rtp",
                    packetsReceived: 300,
                    packetsLost: 100,
                },
                {
                    packetsReceived: 100,
                    packetsLost: 20,
                },
            );
            expect(trackStats.getLoss()).toEqual({ packetsTotal: 280, packetsLost: 80, isDownloadStream: true });
        });
    });

    describe("should set state of a TrackStats", () => {
        it("to not alive if Transceiver undefined", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.setTrackStatsState(trackStats, undefined);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to not alive if Transceiver has no local track", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            const ts = {
                sender: {
                    track: null,
                } as RTCRtpSender,
            } as RTCRtpTransceiver;

            TrackStatsBuilder.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to alive if Transceiver remote and track is alive", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            trackStats.alive = false;
            const ts = {
                receiver: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsBuilder.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
        });

        it("to alive if Transceiver local and track is live", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            trackStats.alive = false;
            const ts = {
                sender: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpSender,
            } as RTCRtpTransceiver;

            TrackStatsBuilder.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
        });

        it("to not alive if Transceiver track is ended", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const ts = {
                receiver: {
                    track: {
                        readyState: "ended",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsBuilder.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to not alive and muted if Transceiver track is live and muted", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const ts = {
                receiver: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: true,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsBuilder.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
            expect(trackStats.muted).toBeTruthy();
        });
    });

    describe("should build Track Summary", () => {
        it("and returns empty summary if stats list empty", async () => {
            const summary = TrackStatsBuilder.buildTrackSummary([]);
            expect(summary).toEqual({
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
        });

        it("and returns  summary if stats list not empty and ignore local summery", async () => {
            const trackStatsList = buildMockTrackStatsList();
            const summary = TrackStatsBuilder.buildTrackSummary(trackStatsList);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 2,
                    muted: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
                videoTrackSummary: {
                    count: 3,
                    muted: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
            });
        });

        it("and returns summary and count muted if alive", async () => {
            const trackStatsList = buildMockTrackStatsList();
            trackStatsList[1].muted = true;
            trackStatsList[5].muted = true;
            const summary = TrackStatsBuilder.buildTrackSummary(trackStatsList);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 2,
                    muted: 1,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
                videoTrackSummary: {
                    count: 3,
                    muted: 1,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
            });
        });

        it("and returns summary and ignore muted if not alive", async () => {
            const trackStatsList = buildMockTrackStatsList();
            trackStatsList[1].muted = true;
            trackStatsList[1].alive = false;
            const summary = TrackStatsBuilder.buildTrackSummary(trackStatsList);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 2,
                    muted: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
                videoTrackSummary: {
                    count: 3,
                    muted: 0,
                    maxJitter: 0,
                    maxPacketLoss: 0,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
            });
        });

        it("and returns summary and build max jitter, packet loss and audio conealment", async () => {
            const trackStatsList = buildMockTrackStatsList();
            // video remote
            trackStatsList[1].setJitter(12);
            trackStatsList[4].setJitter(66);
            trackStatsList[6].setJitter(1);
            trackStatsList[1].setLoss({ packetsLost: 55, packetsTotal: 0, isDownloadStream: true });
            trackStatsList[4].setLoss({ packetsLost: 0, packetsTotal: 0, isDownloadStream: true });
            trackStatsList[6].setLoss({ packetsLost: 1, packetsTotal: 0, isDownloadStream: true });
            // audio remote
            trackStatsList[2].setJitter(1);
            trackStatsList[5].setJitter(15);
            trackStatsList[2].setLoss({ packetsLost: 5, packetsTotal: 0, isDownloadStream: true });
            trackStatsList[5].setLoss({ packetsLost: 0, packetsTotal: 0, isDownloadStream: true });
            trackStatsList[2].setAudioConcealment(220, 2000);
            trackStatsList[5].setAudioConcealment(180, 2000);

            const summary = TrackStatsBuilder.buildTrackSummary(trackStatsList);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 2,
                    muted: 0,
                    maxJitter: 15,
                    maxPacketLoss: 5,
                    concealedAudio: 400,
                    totalAudio: 4000,
                },
                videoTrackSummary: {
                    count: 3,
                    muted: 0,
                    maxJitter: 66,
                    maxPacketLoss: 55,
                    concealedAudio: 0,
                    totalAudio: 0,
                },
            });
        });
    });

    describe("should build jitter value in Track Stats", () => {
        it("and returns track stats without jitter if report not 'inbound-rtp'", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildJitter(trackStats, { jitter: 0.01 });
            expect(trackStats.getJitter()).toEqual(0);
        });

        it("and returns track stats with jitter", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildJitter(trackStats, { type: "inbound-rtp", jitter: 0.01 });
            expect(trackStats.getJitter()).toEqual(10);
        });

        it("and returns negative jitter if stats has no jitter value", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildJitter(trackStats, { type: "inbound-rtp" });
            expect(trackStats.getJitter()).toEqual(-1);
        });

        it("and returns jitter as number", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsBuilder.buildJitter(trackStats, { type: "inbound-rtp", jitter: "0.5" });
            expect(trackStats.getJitter()).toEqual(500);
        });
    });
});

function buildMockTrackStatsList(): MediaTrackStats[] {
    const trackStats1 = new MediaTrackStats("1", "local", "video");
    trackStats1.muted = false;
    trackStats1.alive = true;
    const trackStats2 = new MediaTrackStats("1", "remote", "video");
    trackStats2.muted = false;
    trackStats2.alive = true;
    const trackStats3 = new MediaTrackStats("1", "remote", "audio");
    trackStats3.muted = false;
    trackStats3.alive = true;
    const trackStats4 = new MediaTrackStats("1", "local", "audio");
    trackStats4.muted = false;
    trackStats4.alive = true;
    const trackStats5 = new MediaTrackStats("1", "remote", "video");
    trackStats5.muted = false;
    trackStats5.alive = true;
    const trackStats6 = new MediaTrackStats("1", "remote", "audio");
    trackStats6.muted = false;
    trackStats6.alive = true;
    const trackStats7 = new MediaTrackStats("1", "remote", "video");
    trackStats7.muted = false;
    trackStats7.alive = true;
    return [trackStats1, trackStats2, trackStats3, trackStats4, trackStats5, trackStats6, trackStats7];
}
