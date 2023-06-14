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

import { TrackID } from "../../../../src/webrtc/stats/statsReport";
import { MediaTrackStats } from "../../../../src/webrtc/stats/media/mediaTrackStats";
import { ConnectionStatsReportBuilder } from "../../../../src/webrtc/stats/connectionStatsReportBuilder";

describe("StatsReportBuilder", () => {
    const LOCAL_VIDEO_TRACK_ID = "LOCAL_VIDEO_TRACK_ID";
    const LOCAL_AUDIO_TRACK_ID = "LOCAL_AUDIO_TRACK_ID";
    const REMOTE_AUDIO_TRACK_ID = "REMOTE_AUDIO_TRACK_ID";
    const REMOTE_VIDEO_TRACK_ID = "REMOTE_VIDEO_TRACK_ID";
    const localAudioTrack = new MediaTrackStats(LOCAL_AUDIO_TRACK_ID, "local", "audio");
    const localVideoTrack = new MediaTrackStats(LOCAL_VIDEO_TRACK_ID, "local", "video");
    const remoteAudioTrack = new MediaTrackStats(REMOTE_AUDIO_TRACK_ID, "remote", "audio");
    const remoteVideoTrack = new MediaTrackStats(REMOTE_VIDEO_TRACK_ID, "remote", "video");
    const stats = new Map<TrackID, MediaTrackStats>([
        [LOCAL_AUDIO_TRACK_ID, localAudioTrack],
        [LOCAL_VIDEO_TRACK_ID, localVideoTrack],
        [REMOTE_AUDIO_TRACK_ID, remoteAudioTrack],
        [REMOTE_VIDEO_TRACK_ID, remoteVideoTrack],
    ]);
    beforeEach(() => {
        buildData();
    });

    describe("should build stats", () => {
        it("by media track stats.", async () => {
            expect(ConnectionStatsReportBuilder.build(stats)).toEqual({
                bitrate: {
                    audio: {
                        download: 4000,
                        upload: 5000,
                    },
                    download: 5004000,
                    upload: 3005000,
                    video: {
                        download: 5000000,
                        upload: 3000000,
                    },
                },
                codec: {
                    local: new Map([
                        ["LOCAL_AUDIO_TRACK_ID", "opus"],
                        ["LOCAL_VIDEO_TRACK_ID", "v8"],
                    ]),
                    remote: new Map([
                        ["REMOTE_AUDIO_TRACK_ID", "opus"],
                        ["REMOTE_VIDEO_TRACK_ID", "v9"],
                    ]),
                },
                framerate: {
                    local: new Map([
                        ["LOCAL_AUDIO_TRACK_ID", 0],
                        ["LOCAL_VIDEO_TRACK_ID", 30],
                    ]),
                    remote: new Map([
                        ["REMOTE_AUDIO_TRACK_ID", 0],
                        ["REMOTE_VIDEO_TRACK_ID", 60],
                    ]),
                },
                packetLoss: {
                    download: 7,
                    total: 15,
                    upload: 28,
                },
                resolution: {
                    local: new Map([
                        ["LOCAL_AUDIO_TRACK_ID", { height: -1, width: -1 }],
                        ["LOCAL_VIDEO_TRACK_ID", { height: 460, width: 780 }],
                    ]),
                    remote: new Map([
                        ["REMOTE_AUDIO_TRACK_ID", { height: -1, width: -1 }],
                        ["REMOTE_VIDEO_TRACK_ID", { height: 960, width: 1080 }],
                    ]),
                },
                jitter: new Map([
                    ["REMOTE_AUDIO_TRACK_ID", 0.1],
                    ["REMOTE_VIDEO_TRACK_ID", 50],
                ]),
                audioConcealment: new Map([
                    ["REMOTE_AUDIO_TRACK_ID", { concealedAudio: 3000, totalAudioDuration: 3000 * 20 }],
                ]),
                totalAudioConcealment: {
                    concealedAudio: 3000,
                    totalAudioDuration: (1 / 0.05) * 3000,
                },
            });
        });
    });

    const buildData = (): void => {
        localAudioTrack.setCodec("opus");
        localAudioTrack.setLoss({ packetsTotal: 10, packetsLost: 5, isDownloadStream: false });
        localAudioTrack.setBitrate({ download: 0, upload: 5000 });

        remoteAudioTrack.setCodec("opus");
        remoteAudioTrack.setLoss({ packetsTotal: 20, packetsLost: 0, isDownloadStream: true });
        remoteAudioTrack.setBitrate({ download: 4000, upload: 0 });
        remoteAudioTrack.setJitter(0.1);
        remoteAudioTrack.setAudioConcealment(3000, 3000 * 20);

        localVideoTrack.setCodec("v8");
        localVideoTrack.setLoss({ packetsTotal: 30, packetsLost: 6, isDownloadStream: false });
        localVideoTrack.setBitrate({ download: 0, upload: 3000000 });
        localVideoTrack.setFramerate(30);
        localVideoTrack.setResolution({ width: 780, height: 460 });

        remoteVideoTrack.setCodec("v9");
        remoteVideoTrack.setLoss({ packetsTotal: 40, packetsLost: 4, isDownloadStream: true });
        remoteVideoTrack.setBitrate({ download: 5000000, upload: 0 });
        remoteVideoTrack.setFramerate(60);
        remoteVideoTrack.setResolution({ width: 1080, height: 960 });
        remoteVideoTrack.setJitter(50);
    };
});
