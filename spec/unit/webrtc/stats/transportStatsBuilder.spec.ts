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

import { TransportStatsBuilder } from "../../../../src/webrtc/stats/transportStatsBuilder";
import { TransportStats } from "../../../../src/webrtc/stats/transportStats";

describe("TransportStatsReporter", () => {
    describe("should on build report", () => {
        const REMOTE_CANDIDATE_ID = "REMOTE_CANDIDATE_ID";
        const LOCAL_CANDIDATE_ID = "LOCAL_CANDIDATE_ID";
        const localIC = { ip: "88.88.99.1", port: 56670, protocol: "tcp", candidateType: "local", networkType: "lan" };
        const remoteIC = {
            ip: "123.88.99.1",
            port: 46670,
            protocol: "udp",
            candidateType: "srfx",
            networkType: "wifi",
        };
        const isFocus = false;
        const rtt = 200000;

        it("build new transport stats if all properties there", () => {
            const { report, stats } = mockStatsReport(isFocus, 0);
            const conferenceStatsTransport: TransportStats[] = [];
            const transportStats = TransportStatsBuilder.buildReport(report, stats, conferenceStatsTransport, isFocus);
            expect(transportStats).toEqual([
                {
                    ip: `${remoteIC.ip + 0}:${remoteIC.port}`,
                    type: remoteIC.protocol,
                    localIp: `${localIC.ip + 0}:${localIC.port}`,
                    isFocus,
                    localCandidateType: localIC.candidateType,
                    remoteCandidateType: remoteIC.candidateType,
                    networkType: localIC.networkType,
                    rtt,
                },
            ]);
        });

        it("build next transport stats if candidates different", () => {
            const mock1 = mockStatsReport(isFocus, 0);
            const mock2 = mockStatsReport(isFocus, 1);
            let transportStats: TransportStats[] = [];
            transportStats = TransportStatsBuilder.buildReport(mock1.report, mock1.stats, transportStats, isFocus);
            transportStats = TransportStatsBuilder.buildReport(mock2.report, mock2.stats, transportStats, isFocus);
            expect(transportStats).toEqual([
                {
                    ip: `${remoteIC.ip + 0}:${remoteIC.port}`,
                    type: remoteIC.protocol,
                    localIp: `${localIC.ip + 0}:${localIC.port}`,
                    isFocus,
                    localCandidateType: localIC.candidateType,
                    remoteCandidateType: remoteIC.candidateType,
                    networkType: localIC.networkType,
                    rtt,
                },
                {
                    ip: `${remoteIC.ip + 1}:${remoteIC.port}`,
                    type: remoteIC.protocol,
                    localIp: `${localIC.ip + 1}:${localIC.port}`,
                    isFocus,
                    localCandidateType: localIC.candidateType,
                    remoteCandidateType: remoteIC.candidateType,
                    networkType: localIC.networkType,
                    rtt,
                },
            ]);
        });

        it("build not a second transport stats if candidates the same", () => {
            const mock1 = mockStatsReport(isFocus, 0);
            const mock2 = mockStatsReport(isFocus, 0);
            let transportStats: TransportStats[] = [];
            transportStats = TransportStatsBuilder.buildReport(mock1.report, mock1.stats, transportStats, isFocus);
            transportStats = TransportStatsBuilder.buildReport(mock2.report, mock2.stats, transportStats, isFocus);
            expect(transportStats).toEqual([
                {
                    ip: `${remoteIC.ip + 0}:${remoteIC.port}`,
                    type: remoteIC.protocol,
                    localIp: `${localIC.ip + 0}:${localIC.port}`,
                    isFocus,
                    localCandidateType: localIC.candidateType,
                    remoteCandidateType: remoteIC.candidateType,
                    networkType: localIC.networkType,
                    rtt,
                },
            ]);
        });

        const mockStatsReport = (
            isFocus: boolean,
            prifix: number,
        ): { report: RTCStatsReport; stats: RTCIceCandidatePairStats } => {
            const report = {} as RTCStatsReport;
            report.get = (key: string) => {
                if (key === LOCAL_CANDIDATE_ID) {
                    return { ...localIC, ip: localIC.ip + prifix };
                }
                if (key === REMOTE_CANDIDATE_ID) {
                    return { ...remoteIC, ip: remoteIC.ip + prifix };
                }
                // remote
                return {};
            };
            const stats = {
                remoteCandidateId: REMOTE_CANDIDATE_ID,
                localCandidateId: LOCAL_CANDIDATE_ID,
                currentRoundTripTime: 200,
            } as RTCIceCandidatePairStats;
            return { report, stats };
        };
    });
});
