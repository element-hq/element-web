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

import { TypedEventEmitter } from "../../models/typed-event-emitter";
import {
    ByteSentStatsReport,
    CallFeedReport,
    ConnectionStatsReport,
    StatsReport,
    SummaryStatsReport,
} from "./statsReport";

export type StatsReportHandlerMap = {
    [StatsReport.BYTE_SENT_STATS]: (report: ByteSentStatsReport) => void;
    [StatsReport.CONNECTION_STATS]: (report: ConnectionStatsReport) => void;
    [StatsReport.CALL_FEED_REPORT]: (report: CallFeedReport) => void;
    [StatsReport.SUMMARY_STATS]: (report: SummaryStatsReport) => void;
};

export class StatsReportEmitter extends TypedEventEmitter<StatsReport, StatsReportHandlerMap> {
    public emitByteSendReport(byteSentStats: ByteSentStatsReport): void {
        this.emit(StatsReport.BYTE_SENT_STATS, byteSentStats);
    }

    public emitConnectionStatsReport(report: ConnectionStatsReport): void {
        this.emit(StatsReport.CONNECTION_STATS, report);
    }

    public emitCallFeedReport(report: CallFeedReport): void {
        this.emit(StatsReport.CALL_FEED_REPORT, report);
    }

    public emitSummaryStatsReport(report: SummaryStatsReport): void {
        this.emit(StatsReport.SUMMARY_STATS, report);
    }
}
