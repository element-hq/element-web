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
import { MediaTrackHandler } from "../../../../../src/webrtc/stats/media/mediaTrackHandler";
import { MediaTrackStatsHandler } from "../../../../../src/webrtc/stats/media/mediaTrackStatsHandler";
import { MediaSsrcHandler } from "../../../../../src/webrtc/stats/media/mediaSsrcHandler";

describe("MediaTrackStatsHandler", () => {
    let statsHandler: MediaTrackStatsHandler;
    let ssrcHandler: MediaSsrcHandler;
    let trackHandler: MediaTrackHandler;
    beforeEach(() => {
        ssrcHandler = {} as MediaSsrcHandler;
        trackHandler = {} as MediaTrackHandler;
        trackHandler.getLocalTrackIdByMid = jest.fn().mockReturnValue("2222");
        trackHandler.getRemoteTrackIdByMid = jest.fn().mockReturnValue("5555");
        trackHandler.getLocalTracks = jest.fn().mockReturnValue([{ id: "2222" } as MediaStreamTrack]);
        trackHandler.getTackById = jest.fn().mockReturnValue([{ id: "2222", kind: "audio" } as MediaStreamTrack]);
        statsHandler = new MediaTrackStatsHandler(ssrcHandler, trackHandler);
    });
    describe("should find track stats", () => {
        it("and returns stats if `trackIdentifier` exists in report", () => {
            const report = { trackIdentifier: "123" };
            expect(statsHandler.findTrack2Stats(report, "remote")?.trackId).toEqual("123");
        });
        it("and returns stats if `mid` exists in report", () => {
            const reportIn = { mid: "1", type: "inbound-rtp" };
            expect(statsHandler.findTrack2Stats(reportIn, "remote")?.trackId).toEqual("5555");
            const reportOut = { mid: "1", type: "outbound-rtp" };
            expect(statsHandler.findTrack2Stats(reportOut, "local")?.trackId).toEqual("2222");
        });
        it("and returns undefined if `ssrc` exists in report but not on connection", () => {
            const report = { ssrc: "142443", type: "inbound-rtp" };
            ssrcHandler.findMidBySsrc = jest.fn().mockReturnValue(undefined);
            expect(statsHandler.findTrack2Stats(report, "local")?.trackId).toBeUndefined();
        });
        it("and returns undefined if `ssrc` exists in inbound-rtp report", () => {
            const report = { ssrc: "142443", type: "inbound-rtp" };
            ssrcHandler.findMidBySsrc = jest.fn().mockReturnValue("2");
            expect(statsHandler.findTrack2Stats(report, "remote")?.trackId).toEqual("5555");
        });
        it("and returns undefined if `ssrc` exists in outbound-rtp report", () => {
            const report = { ssrc: "142443", type: "outbound-rtp" };
            ssrcHandler.findMidBySsrc = jest.fn().mockReturnValue("2");
            expect(statsHandler.findTrack2Stats(report, "local")?.trackId).toEqual("2222");
        });
        it("and returns undefined if needed property not existing", () => {
            const report = {};
            expect(statsHandler.findTrack2Stats(report, "remote")?.trackId).toBeUndefined();
        });
    });
    describe("should find local video track stats", () => {
        it("and returns stats if `trackIdentifier` exists in report", async () => {
            const report = { trackIdentifier: "2222" };
            expect(statsHandler.findLocalVideoTrackStats(report)?.trackId).toEqual("2222");
        });
        it("and returns stats if `mid` exists in report", () => {
            const report = { mid: "1" };
            expect(statsHandler.findLocalVideoTrackStats(report)?.trackId).toEqual("2222");
        });
        it("and returns undefined if `ssrc` exists", () => {
            const report = { ssrc: "142443", type: "outbound-rtp" };
            ssrcHandler.findMidBySsrc = jest.fn().mockReturnValue("2");
            expect(statsHandler.findTrack2Stats(report, "local")?.trackId).toEqual("2222");
        });
        it("and returns undefined if needed property not existing", async () => {
            const report = {};
            expect(statsHandler.findTrack2Stats(report, "remote")?.trackId).toBeUndefined();
        });
    });

    describe("should find a Transceiver by Track id", () => {
        it("and returns undefined if Transceiver not existing", async () => {
            trackHandler.getTransceiverByTrackId = jest.fn().mockReturnValue(undefined);
            expect(statsHandler.findTransceiverByTrackId("12")).toBeUndefined();
        });

        it("and returns Transceiver if existing", async () => {
            const ts = {} as RTCRtpTransceiver;
            trackHandler.getTransceiverByTrackId = jest.fn().mockReturnValue(ts);
            expect(statsHandler.findTransceiverByTrackId("12")).toEqual(ts);
        });
    });
});
