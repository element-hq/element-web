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

import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecordingsStoreEvent,
    VoiceBroadcastRecording,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkStubRoom, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

describe("VoiceBroadcastRecordingsStore", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let infoEvent: MatrixEvent;
    let otherInfoEvent: MatrixEvent;
    let recording: VoiceBroadcastRecording;
    let otherRecording: VoiceBroadcastRecording;
    let recordings: VoiceBroadcastRecordingsStore;
    let onCurrentChanged: (recording: VoiceBroadcastRecording | null) => void;

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom(roomId, "test room", client);
        mocked(client.getRoom).mockImplementation((roomId: string) => {
            if (roomId === room.roomId) {
                return room;
            }
            return null;
        });
        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.getDeviceId()!,
        );
        otherInfoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.getDeviceId()!,
        );
        recording = new VoiceBroadcastRecording(infoEvent, client);
        otherRecording = new VoiceBroadcastRecording(otherInfoEvent, client);
        recordings = new VoiceBroadcastRecordingsStore();
        onCurrentChanged = jest.fn();
        recordings.on(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, onCurrentChanged);
    });

    afterEach(() => {
        recording.destroy();
        recordings.off(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, onCurrentChanged);
    });

    it("when setting a recording without info event Id, it should raise an error", () => {
        infoEvent.event.event_id = undefined;
        expect(() => {
            recordings.setCurrent(recording);
        }).toThrow("Got broadcast info event without Id");
    });

    describe("when setting a current Voice Broadcast recording", () => {
        beforeEach(() => {
            recordings.setCurrent(recording);
        });

        it("should return it as current", () => {
            expect(recordings.hasCurrent()).toBe(true);
            expect(recordings.getCurrent()).toBe(recording);
        });

        it("should return it by id", () => {
            expect(recordings.getByInfoEvent(infoEvent, client)).toBe(recording);
        });

        it("should emit a CurrentChanged event", () => {
            expect(onCurrentChanged).toHaveBeenCalledWith(recording);
        });

        describe("and setting the same again", () => {
            beforeEach(() => {
                mocked(onCurrentChanged).mockClear();
                recordings.setCurrent(recording);
            });

            it("should not emit a CurrentChanged event", () => {
                expect(onCurrentChanged).not.toHaveBeenCalled();
            });
        });

        describe("and calling clearCurrent()", () => {
            beforeEach(() => {
                recordings.clearCurrent();
            });

            it("should clear the current recording", () => {
                expect(recordings.hasCurrent()).toBe(false);
                expect(recordings.getCurrent()).toBeNull();
            });

            it("should emit a current changed event", () => {
                expect(onCurrentChanged).toHaveBeenCalledWith(null);
            });

            it("and calling it again should work", () => {
                recordings.clearCurrent();
                expect(recordings.getCurrent()).toBeNull();
            });
        });

        describe("and setting another recording and stopping the previous recording", () => {
            beforeEach(() => {
                recordings.setCurrent(otherRecording);
                recording.stop();
            });

            it("should keep the current recording", () => {
                expect(recordings.getCurrent()).toBe(otherRecording);
            });
        });

        describe("and the recording stops", () => {
            beforeEach(() => {
                recording.stop();
            });

            it("should clear the current recording", () => {
                expect(recordings.getCurrent()).toBeNull();
            });
        });
    });

    describe("getByInfoEventId", () => {
        let returnedRecording: VoiceBroadcastRecording;

        describe("when retrieving a known recording", () => {
            beforeEach(() => {
                recordings.setCurrent(recording);
                returnedRecording = recordings.getByInfoEvent(infoEvent, client);
            });

            it("should return the recording", () => {
                expect(returnedRecording).toBe(recording);
            });
        });

        describe("when retrieving an unknown recording", () => {
            beforeEach(() => {
                returnedRecording = recordings.getByInfoEvent(infoEvent, client);
            });

            it("should return the recording", () => {
                expect(returnedRecording.infoEvent).toBe(infoEvent);
            });
        });
    });
});
