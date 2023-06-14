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
import { CallStatsReportGatherer } from "./callStatsReportGatherer";
import { StatsReportEmitter } from "./statsReportEmitter";
import { CallStatsReportSummary } from "./callStatsReportSummary";
import { SummaryStatsReportGatherer } from "./summaryStatsReportGatherer";
import { logger } from "../../logger";

export class GroupCallStats {
    private timer: undefined | ReturnType<typeof setTimeout>;
    private readonly gatherers: Map<string, CallStatsReportGatherer> = new Map<string, CallStatsReportGatherer>();
    public readonly reports = new StatsReportEmitter();
    private readonly summaryStatsReportGatherer = new SummaryStatsReportGatherer(this.reports);

    public constructor(private groupCallId: string, private userId: string, private interval: number = 10000) {}

    public start(): void {
        if (this.timer === undefined && this.interval > 0) {
            this.timer = setInterval(() => {
                this.processStats();
            }, this.interval);
        }
    }

    public stop(): void {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.gatherers.forEach((c) => c.stopProcessingStats());
        }
    }

    public hasStatsReportGatherer(callId: string): boolean {
        return this.gatherers.has(callId);
    }

    public addStatsReportGatherer(
        callId: string,
        opponentMemberId: string,
        peerConnection: RTCPeerConnection,
    ): boolean {
        if (this.hasStatsReportGatherer(callId)) {
            return false;
        }
        this.gatherers.set(callId, new CallStatsReportGatherer(callId, opponentMemberId, peerConnection, this.reports));
        return true;
    }

    public removeStatsReportGatherer(callId: string): boolean {
        return this.gatherers.delete(callId);
    }

    public getStatsReportGatherer(callId: string): CallStatsReportGatherer | undefined {
        return this.hasStatsReportGatherer(callId) ? this.gatherers.get(callId) : undefined;
    }

    public updateOpponentMember(callId: string, opponentMember: string): void {
        this.getStatsReportGatherer(callId)?.setOpponentMemberId(opponentMember);
    }

    private processStats(): void {
        const summary: Promise<CallStatsReportSummary>[] = [];
        this.gatherers.forEach((c) => {
            summary.push(c.processStats(this.groupCallId, this.userId));
        });

        Promise.all(summary)
            .then((s: Awaited<CallStatsReportSummary>[]) => this.summaryStatsReportGatherer.build(s))
            .catch((err) => {
                logger.error("Could not build summary stats report", err);
            });
    }

    public setInterval(interval: number): void {
        this.interval = interval;
    }
}
