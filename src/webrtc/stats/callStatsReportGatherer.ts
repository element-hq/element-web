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

import { ConnectionStats } from "./connectionStats";
import { StatsReportEmitter } from "./statsReportEmitter";
import { ByteSend, ByteSentStatsReport, TrackID } from "./statsReport";
import { ConnectionStatsBuilder } from "./connectionStatsBuilder";
import { TransportStatsBuilder } from "./transportStatsBuilder";
import { MediaSsrcHandler } from "./media/mediaSsrcHandler";
import { MediaTrackHandler } from "./media/mediaTrackHandler";
import { MediaTrackStatsHandler } from "./media/mediaTrackStatsHandler";
import { TrackStatsBuilder } from "./trackStatsBuilder";
import { ConnectionStatsReportBuilder } from "./connectionStatsReportBuilder";
import { ValueFormatter } from "./valueFormatter";
import { CallStatsReportSummary } from "./callStatsReportSummary";
import { logger } from "../../logger";
import { CallFeedStatsReporter } from "./callFeedStatsReporter";

export class CallStatsReportGatherer {
    private isActive = true;
    private previousStatsReport: RTCStatsReport | undefined;
    private currentStatsReport: RTCStatsReport | undefined;
    private readonly connectionStats = new ConnectionStats();

    private readonly trackStats: MediaTrackStatsHandler;

    public constructor(
        public readonly callId: string,
        private opponentMemberId: string,
        private readonly pc: RTCPeerConnection,
        private readonly emitter: StatsReportEmitter,
        private readonly isFocus = true,
    ) {
        pc.addEventListener("signalingstatechange", this.onSignalStateChange.bind(this));
        this.trackStats = new MediaTrackStatsHandler(new MediaSsrcHandler(), new MediaTrackHandler(pc));
    }

    public async processStats(groupCallId: string, localUserId: string): Promise<CallStatsReportSummary> {
        const summary = {
            isFirstCollection: this.previousStatsReport === undefined,
            receivedMedia: 0,
            receivedAudioMedia: 0,
            receivedVideoMedia: 0,
            audioTrackSummary: { count: 0, muted: 0, maxPacketLoss: 0, maxJitter: 0, concealedAudio: 0, totalAudio: 0 },
            videoTrackSummary: { count: 0, muted: 0, maxPacketLoss: 0, maxJitter: 0, concealedAudio: 0, totalAudio: 0 },
        } as CallStatsReportSummary;
        if (this.isActive) {
            const statsPromise = this.pc.getStats();
            if (typeof statsPromise?.then === "function") {
                return statsPromise
                    .then((report) => {
                        // @ts-ignore
                        this.currentStatsReport = typeof report?.result === "function" ? report.result() : report;

                        try {
                            this.processStatsReport(groupCallId, localUserId);
                        } catch (error) {
                            this.handleError(error);
                            return summary;
                        }

                        this.previousStatsReport = this.currentStatsReport;
                        summary.receivedMedia = this.connectionStats.bitrate.download;
                        summary.receivedAudioMedia = this.connectionStats.bitrate.audio?.download || 0;
                        summary.receivedVideoMedia = this.connectionStats.bitrate.video?.download || 0;
                        const trackSummary = TrackStatsBuilder.buildTrackSummary(
                            Array.from(this.trackStats.getTrack2stats().values()),
                        );
                        return {
                            ...summary,
                            audioTrackSummary: trackSummary.audioTrackSummary,
                            videoTrackSummary: trackSummary.videoTrackSummary,
                        };
                    })
                    .catch((error) => {
                        this.handleError(error);
                        return summary;
                    });
            }
            this.isActive = false;
        }
        return Promise.resolve(summary);
    }

    private processStatsReport(groupCallId: string, localUserId: string): void {
        const byteSentStatsReport: ByteSentStatsReport = new Map<TrackID, ByteSend>() as ByteSentStatsReport;
        byteSentStatsReport.callId = this.callId;
        byteSentStatsReport.opponentMemberId = this.opponentMemberId;

        this.currentStatsReport?.forEach((now) => {
            const before = this.previousStatsReport ? this.previousStatsReport.get(now.id) : null;
            // RTCIceCandidatePairStats - https://w3c.github.io/webrtc-stats/#candidatepair-dict*
            if (now.type === "candidate-pair" && now.nominated && now.state === "succeeded") {
                this.connectionStats.bandwidth = ConnectionStatsBuilder.buildBandwidthReport(now);
                this.connectionStats.transport = TransportStatsBuilder.buildReport(
                    this.currentStatsReport,
                    now,
                    this.connectionStats.transport,
                    this.isFocus,
                );

                // RTCReceivedRtpStreamStats
                // https://w3c.github.io/webrtc-stats/#receivedrtpstats-dict*
                // RTCSentRtpStreamStats
                // https://w3c.github.io/webrtc-stats/#sentrtpstats-dict*
            } else if (now.type === "inbound-rtp" || now.type === "outbound-rtp") {
                const trackStats = this.trackStats.findTrack2Stats(
                    now,
                    now.type === "inbound-rtp" ? "remote" : "local",
                );
                if (!trackStats) {
                    return;
                }

                if (before) {
                    TrackStatsBuilder.buildPacketsLost(trackStats, now, before);
                }

                // Get the resolution and framerate for only remote video sources here. For the local video sources,
                // 'track' stats will be used since they have the updated resolution based on the simulcast streams
                // currently being sent. Promise based getStats reports three 'outbound-rtp' streams and there will be
                // more calculations needed to determine what is the highest resolution stream sent by the client if the
                // 'outbound-rtp' stats are used.
                if (now.type === "inbound-rtp") {
                    TrackStatsBuilder.buildFramerateResolution(trackStats, now);
                    if (before) {
                        TrackStatsBuilder.buildBitrateReceived(trackStats, now, before);
                    }
                    const ts = this.trackStats.findTransceiverByTrackId(trackStats.trackId);
                    TrackStatsBuilder.setTrackStatsState(trackStats, ts);
                    TrackStatsBuilder.buildJitter(trackStats, now);
                    TrackStatsBuilder.buildAudioConcealment(trackStats, now);
                } else if (before) {
                    byteSentStatsReport.set(trackStats.trackId, ValueFormatter.getNonNegativeValue(now.bytesSent));
                    TrackStatsBuilder.buildBitrateSend(trackStats, now, before);
                }
                TrackStatsBuilder.buildCodec(this.currentStatsReport, trackStats, now);
            } else if (now.type === "track" && now.kind === "video" && !now.remoteSource) {
                const trackStats = this.trackStats.findLocalVideoTrackStats(now);
                if (!trackStats) {
                    return;
                }
                TrackStatsBuilder.buildFramerateResolution(trackStats, now);
                TrackStatsBuilder.calculateSimulcastFramerate(
                    trackStats,
                    now,
                    before,
                    this.trackStats.mediaTrackHandler.getActiveSimulcastStreams(),
                );
            }
        });

        this.emitter.emitByteSendReport(byteSentStatsReport);
        this.emitter.emitCallFeedReport(
            CallFeedStatsReporter.buildCallFeedReport(this.callId, this.opponentMemberId, this.pc),
        );
        this.processAndEmitConnectionStatsReport();
    }

    public setActive(isActive: boolean): void {
        this.isActive = isActive;
    }

    public getActive(): boolean {
        return this.isActive;
    }

    private handleError(error: any): void {
        this.isActive = false;
        logger.warn(`CallStatsReportGatherer ${this.callId} processStatsReport fails and set to inactive ${error}`);
    }

    private processAndEmitConnectionStatsReport(): void {
        const report = ConnectionStatsReportBuilder.build(this.trackStats.getTrack2stats());
        report.callId = this.callId;
        report.opponentMemberId = this.opponentMemberId;

        this.connectionStats.bandwidth = report.bandwidth;
        this.connectionStats.bitrate = report.bitrate;
        this.connectionStats.packetLoss = report.packetLoss;

        this.emitter.emitConnectionStatsReport({
            ...report,
            transport: this.connectionStats.transport,
        });

        this.connectionStats.transport = [];
    }

    public stopProcessingStats(): void {}

    private onSignalStateChange(): void {
        if (this.pc.signalingState === "stable") {
            if (this.pc.currentRemoteDescription) {
                this.trackStats.mediaSsrcHandler.parse(this.pc.currentRemoteDescription.sdp, "remote");
            }
            if (this.pc.currentLocalDescription) {
                this.trackStats.mediaSsrcHandler.parse(this.pc.currentLocalDescription.sdp, "local");
            }
        }
    }

    public setOpponentMemberId(id: string): void {
        this.opponentMemberId = id;
    }
}
