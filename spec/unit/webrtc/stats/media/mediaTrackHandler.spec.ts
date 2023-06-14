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

describe("TrackHandler", () => {
    let pc: RTCPeerConnection;
    let handler: MediaTrackHandler;
    beforeEach(() => {
        pc = {
            getTransceivers: (): RTCRtpTransceiver[] => [mockTransceiver("1", "audio"), mockTransceiver("2", "video")],
        } as RTCPeerConnection;
        handler = new MediaTrackHandler(pc);
    });
    describe("should get local tracks", () => {
        it("returns video track", async () => {
            expect(handler.getLocalTracks("video")).toEqual([
                {
                    id: `sender-track-2`,
                    kind: "video",
                } as MediaStreamTrack,
            ]);
        });

        it("returns audio track", async () => {
            expect(handler.getLocalTracks("audio")).toEqual([
                {
                    id: `sender-track-1`,
                    kind: "audio",
                } as MediaStreamTrack,
            ]);
        });
    });

    describe("should get local track by mid", () => {
        it("returns video track", async () => {
            expect(handler.getLocalTrackIdByMid("2")).toEqual("sender-track-2");
        });

        it("returns audio track", async () => {
            expect(handler.getLocalTrackIdByMid("1")).toEqual("sender-track-1");
        });

        it("returns undefined if not exists", async () => {
            expect(handler.getLocalTrackIdByMid("3")).toBeUndefined();
        });
    });

    describe("should get remote track by mid", () => {
        it("returns video track", async () => {
            expect(handler.getRemoteTrackIdByMid("2")).toEqual("receiver-track-2");
        });

        it("returns audio track", async () => {
            expect(handler.getRemoteTrackIdByMid("1")).toEqual("receiver-track-1");
        });

        it("returns undefined if not exists", async () => {
            expect(handler.getRemoteTrackIdByMid("3")).toBeUndefined();
        });
    });

    describe("should get track by id", () => {
        it("returns remote track", async () => {
            expect(handler.getTackById("receiver-track-2")).toEqual({
                id: `receiver-track-2`,
                kind: "video",
            } as MediaStreamTrack);
        });

        it("returns local track", async () => {
            expect(handler.getTackById("sender-track-1")).toEqual({
                id: `sender-track-1`,
                kind: "audio",
            } as MediaStreamTrack);
        });

        it("returns undefined if not exists", async () => {
            expect(handler.getTackById("sender-track-3")).toBeUndefined();
        });
    });

    describe("should get simulcast track count", () => {
        it("returns 2", async () => {
            expect(handler.getActiveSimulcastStreams()).toEqual(3);
        });
    });

    describe("should get Transceiver by Track ID", () => {
        it("and returns remote Transceiver if exits", async () => {
            expect(handler.getTransceiverByTrackId(`receiver-track-1`)?.mid).toEqual("1");
        });

        it("and returns local Transceiver if exits", async () => {
            expect(handler.getTransceiverByTrackId(`sender-track-2`)?.mid).toEqual("2");
        });

        it("returns undefined if Transceiver not  exits", async () => {
            expect(handler.getTransceiverByTrackId("22")).toBeUndefined();
        });
    });
});

const mockTransceiver = (mid: string, kind: "video" | "audio"): RTCRtpTransceiver => {
    return {
        mid,
        currentDirection: "sendrecv",
        sender: {
            track: { id: `sender-track-${mid}`, kind } as MediaStreamTrack,
        } as RTCRtpSender,
        receiver: {
            track: { id: `receiver-track-${mid}`, kind } as MediaStreamTrack,
        } as RTCRtpReceiver,
    } as RTCRtpTransceiver;
};
