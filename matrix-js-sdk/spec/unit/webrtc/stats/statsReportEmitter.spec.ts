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
import { StatsReportEmitter } from "../../../../src/webrtc/stats/statsReportEmitter";
import {
    ByteSentStatsReport,
    CallFeedReport,
    ConnectionStatsReport,
    StatsReport,
    SummaryStatsReport,
} from "../../../../src/webrtc/stats/statsReport";

describe("StatsReportEmitter", () => {
    let emitter: StatsReportEmitter;
    beforeEach(() => {
        emitter = new StatsReportEmitter();
    });

    it("should emit and receive ByteSendStatsReport", async () => {
        const report = {} as ByteSentStatsReport;
        return new Promise((resolve, _) => {
            emitter.on(StatsReport.BYTE_SENT_STATS, (r) => {
                expect(r).toBe(report);
                resolve(null);
                return;
            });
            emitter.emitByteSendReport(report);
        });
    });

    it("should emit and receive ConnectionStatsReport", async () => {
        const report = {} as ConnectionStatsReport;
        return new Promise((resolve, _) => {
            emitter.on(StatsReport.CONNECTION_STATS, (r) => {
                expect(r).toBe(report);
                resolve(null);
                return;
            });
            emitter.emitConnectionStatsReport(report);
        });
    });

    it("should emit and receive SummaryStatsReport", async () => {
        const report = {} as SummaryStatsReport;
        return new Promise((resolve, _) => {
            emitter.on(StatsReport.SUMMARY_STATS, (r) => {
                expect(r).toBe(report);
                resolve(null);
                return;
            });
            emitter.emitSummaryStatsReport(report);
        });
    });

    it("should emit and receive CallFeedReports", async () => {
        const report = {} as CallFeedReport;
        return new Promise((resolve, _) => {
            emitter.on(StatsReport.CALL_FEED_REPORT, (r) => {
                expect(r).toBe(report);
                resolve(null);
                return;
            });
            emitter.emitCallFeedReport(report);
        });
    });
});
