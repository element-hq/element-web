/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastChunkEvents } from "../../../src/voice-broadcast/utils/VoiceBroadcastChunkEvents";
import { mkVoiceBroadcastChunkEvent } from "./test-utils";

describe("VoiceBroadcastChunkEvents", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    const txnId = "txn-id";
    let eventSeq1Time1: MatrixEvent;
    let eventSeq2Time4: MatrixEvent;
    let eventSeq3Time2: MatrixEvent;
    let eventSeq3Time2T: MatrixEvent;
    let eventSeq4Time1: MatrixEvent;
    let eventSeqUTime3: MatrixEvent;
    let eventSeq2Time4Dup: MatrixEvent;
    let chunkEvents: VoiceBroadcastChunkEvents;

    beforeEach(() => {
        eventSeq1Time1 = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 7, 1, 1);
        eventSeq2Time4 = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 23, 2, 4);
        eventSeq2Time4Dup = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 3141, 2, 4);
        jest.spyOn(eventSeq2Time4Dup, "getId").mockReturnValue(eventSeq2Time4.getId());
        eventSeq3Time2 = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 42, 3, 2);
        eventSeq3Time2.setTxnId(txnId);
        eventSeq3Time2T = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 42, 3, 2);
        eventSeq3Time2T.setTxnId(txnId);
        eventSeq4Time1 = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 69, 4, 1);
        eventSeqUTime3 = mkVoiceBroadcastChunkEvent("info1", userId, roomId, 314, undefined, 3);
        chunkEvents = new VoiceBroadcastChunkEvents();
    });

    describe("when adding events that all have a sequence", () => {
        beforeEach(() => {
            chunkEvents.addEvent(eventSeq2Time4);
            chunkEvents.addEvent(eventSeq1Time1);
            chunkEvents.addEvents([eventSeq4Time1, eventSeq2Time4Dup, eventSeq3Time2]);
        });

        it("should provide the events sort by sequence", () => {
            expect(chunkEvents.getEvents()).toEqual([
                eventSeq1Time1,
                eventSeq2Time4Dup,
                eventSeq3Time2,
                eventSeq4Time1,
            ]);
        });

        it("getNumberOfEvents should return 4", () => {
            expect(chunkEvents.getNumberOfEvents()).toBe(4);
        });

        it("getLength should return the total length of all chunks", () => {
            expect(chunkEvents.getLength()).toBe(3259);
        });

        it("getLengthTo(first event) should return 0", () => {
            expect(chunkEvents.getLengthTo(eventSeq1Time1)).toBe(0);
        });

        it("getLengthTo(some event) should return the time excl. that event", () => {
            expect(chunkEvents.getLengthTo(eventSeq3Time2)).toBe(7 + 3141);
        });

        it("getLengthTo(last event) should return the time excl. that event", () => {
            expect(chunkEvents.getLengthTo(eventSeq4Time1)).toBe(7 + 3141 + 42);
        });

        it("should return the expected next chunk", () => {
            expect(chunkEvents.getNext(eventSeq2Time4Dup)).toBe(eventSeq3Time2);
        });

        it("should return undefined for next last chunk", () => {
            expect(chunkEvents.getNext(eventSeq4Time1)).toBeUndefined();
        });

        it("findByTime(0) should return the first chunk", () => {
            expect(chunkEvents.findByTime(0)).toBe(eventSeq1Time1);
        });

        it("findByTime(some time) should return the chunk with this time", () => {
            expect(chunkEvents.findByTime(7 + 3141 + 21)).toBe(eventSeq3Time2);
        });

        it("findByTime(entire duration) should return the last chunk", () => {
            expect(chunkEvents.findByTime(7 + 3141 + 42 + 69)).toBe(eventSeq4Time1);
        });

        describe("and adding an event with a known transaction Id", () => {
            beforeEach(() => {
                chunkEvents.addEvent(eventSeq3Time2T);
            });

            it("should replace the previous event", () => {
                expect(chunkEvents.getEvents()).toEqual([
                    eventSeq1Time1,
                    eventSeq2Time4Dup,
                    eventSeq3Time2T,
                    eventSeq4Time1,
                ]);
                expect(chunkEvents.getNumberOfEvents()).toBe(4);
            });
        });
    });

    describe("when adding events where at least one does not have a sequence", () => {
        beforeEach(() => {
            chunkEvents.addEvent(eventSeq2Time4);
            chunkEvents.addEvent(eventSeq1Time1);
            chunkEvents.addEvents([eventSeq4Time1, eventSeqUTime3, eventSeq2Time4Dup, eventSeq3Time2]);
        });

        it("should provide the events sort by timestamp without duplicates", () => {
            expect(chunkEvents.getEvents()).toEqual([
                eventSeq1Time1,
                eventSeq4Time1,
                eventSeq3Time2,
                eventSeqUTime3,
                eventSeq2Time4Dup,
            ]);
            expect(chunkEvents.getNumberOfEvents()).toBe(5);
        });

        describe("getSequenceForEvent", () => {
            it("should return the sequence if provided by the event", () => {
                expect(chunkEvents.getSequenceForEvent(eventSeq3Time2)).toBe(3);
            });

            it("should return the index if no sequence provided by event", () => {
                expect(chunkEvents.getSequenceForEvent(eventSeqUTime3)).toBe(4);
            });
        });
    });
});
