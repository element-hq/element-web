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
import { AudioConcealment, CodecMap, ConnectionStatsReport, FramerateMap, ResolutionMap, TrackID } from "./statsReport";
import { MediaTrackStats, Resolution } from "./media/mediaTrackStats";

export class ConnectionStatsReportBuilder {
    public static build(stats: Map<TrackID, MediaTrackStats>): ConnectionStatsReport {
        const report = {} as ConnectionStatsReport;

        // process stats
        const totalPackets = {
            download: 0,
            upload: 0,
        };
        const lostPackets = {
            download: 0,
            upload: 0,
        };
        let bitrateDownload = 0;
        let bitrateUpload = 0;
        const resolutions: ResolutionMap = {
            local: new Map<TrackID, Resolution>(),
            remote: new Map<TrackID, Resolution>(),
        };
        const framerates: FramerateMap = { local: new Map<TrackID, number>(), remote: new Map<TrackID, number>() };
        const codecs: CodecMap = { local: new Map<TrackID, string>(), remote: new Map<TrackID, string>() };
        const jitter = new Map<TrackID, number>();
        const audioConcealment = new Map<TrackID, AudioConcealment>();

        let audioBitrateDownload = 0;
        let audioBitrateUpload = 0;
        let videoBitrateDownload = 0;
        let videoBitrateUpload = 0;

        let totalConcealedAudio = 0;
        let totalAudioDuration = 0;

        for (const [trackId, trackStats] of stats) {
            // process packet loss stats
            const loss = trackStats.getLoss();
            const type = loss.isDownloadStream ? "download" : "upload";

            totalPackets[type] += loss.packetsTotal;
            lostPackets[type] += loss.packetsLost;

            // process bitrate stats
            bitrateDownload += trackStats.getBitrate().download;
            bitrateUpload += trackStats.getBitrate().upload;

            // collect resolutions and framerates
            if (trackStats.kind === "audio") {
                // process audio quality stats
                const audioConcealmentForTrack = trackStats.getAudioConcealment();
                totalConcealedAudio += audioConcealmentForTrack.concealedAudio;
                totalAudioDuration += audioConcealmentForTrack.totalAudioDuration;

                audioBitrateDownload += trackStats.getBitrate().download;
                audioBitrateUpload += trackStats.getBitrate().upload;
            } else {
                videoBitrateDownload += trackStats.getBitrate().download;
                videoBitrateUpload += trackStats.getBitrate().upload;
            }

            resolutions[trackStats.getType()].set(trackId, trackStats.getResolution());
            framerates[trackStats.getType()].set(trackId, trackStats.getFramerate());
            codecs[trackStats.getType()].set(trackId, trackStats.getCodec());
            if (trackStats.getType() === "remote") {
                jitter.set(trackId, trackStats.getJitter());
                if (trackStats.kind === "audio") {
                    audioConcealment.set(trackId, trackStats.getAudioConcealment());
                }
            }

            trackStats.resetBitrate();
        }

        report.bitrate = {
            upload: bitrateUpload,
            download: bitrateDownload,
        };

        report.bitrate.audio = {
            upload: audioBitrateUpload,
            download: audioBitrateDownload,
        };

        report.bitrate.video = {
            upload: videoBitrateUpload,
            download: videoBitrateDownload,
        };

        report.packetLoss = {
            total: ConnectionStatsReportBuilder.calculatePacketLoss(
                lostPackets.download + lostPackets.upload,
                totalPackets.download + totalPackets.upload,
            ),
            download: ConnectionStatsReportBuilder.calculatePacketLoss(lostPackets.download, totalPackets.download),
            upload: ConnectionStatsReportBuilder.calculatePacketLoss(lostPackets.upload, totalPackets.upload),
        };
        report.audioConcealment = audioConcealment;
        report.totalAudioConcealment = {
            concealedAudio: totalConcealedAudio,
            totalAudioDuration,
        };

        report.framerate = framerates;
        report.resolution = resolutions;
        report.codec = codecs;
        report.jitter = jitter;
        return report;
    }

    private static calculatePacketLoss(lostPackets: number, totalPackets: number): number {
        if (!totalPackets || totalPackets <= 0 || !lostPackets || lostPackets <= 0) {
            return 0;
        }

        return Math.round((lostPackets / totalPackets) * 100);
    }
}
