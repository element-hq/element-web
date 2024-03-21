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
import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";

describe("VoiceBroadcastPreRecordingStore", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let sender: RoomMember;
    let playbacksStore: VoiceBroadcastPlaybacksStore;
    let recordingsStore: VoiceBroadcastRecordingsStore;
    let store: VoiceBroadcastPreRecordingStore;
    let preRecording1: VoiceBroadcastPreRecording;

    beforeAll(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId() || "");
        sender = new RoomMember(roomId, client.getUserId() || "");
        recordingsStore = new VoiceBroadcastRecordingsStore();
        playbacksStore = new VoiceBroadcastPlaybacksStore(recordingsStore);
    });

    beforeEach(() => {
        store = new VoiceBroadcastPreRecordingStore();
        jest.spyOn(store, "emit");
        jest.spyOn(store, "removeAllListeners");
        preRecording1 = new VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
        jest.spyOn(preRecording1, "off");
    });

    it("getCurrent() should return null", () => {
        expect(store.getCurrent()).toBeNull();
    });

    it("clearCurrent() should work", () => {
        store.clearCurrent();
        expect(store.getCurrent()).toBeNull();
    });

    describe("when setting a current recording", () => {
        beforeEach(() => {
            store.setCurrent(preRecording1);
        });

        it("getCurrent() should return the recording", () => {
            expect(store.getCurrent()).toBe(preRecording1);
        });

        it("should emit a changed event with the recording", () => {
            expect(store.emit).toHaveBeenCalledWith("changed", preRecording1);
        });

        describe("and calling destroy()", () => {
            beforeEach(() => {
                store.destroy();
            });

            it("should remove all listeners", () => {
                expect(store.removeAllListeners).toHaveBeenCalled();
            });

            it("should deregister from the pre-recordings", () => {
                expect(preRecording1.off).toHaveBeenCalledWith("dismiss", expect.any(Function));
            });
        });

        describe("and cancelling the pre-recording", () => {
            beforeEach(() => {
                preRecording1.cancel();
            });

            it("should clear the current recording", () => {
                expect(store.getCurrent()).toBeNull();
            });

            it("should emit a changed event with null", () => {
                expect(store.emit).toHaveBeenCalledWith("changed", null);
            });
        });

        describe("and setting the same pre-recording again", () => {
            beforeEach(() => {
                mocked(store.emit).mockClear();
                store.setCurrent(preRecording1);
            });

            it("should not emit a changed event", () => {
                expect(store.emit).not.toHaveBeenCalled();
            });
        });

        describe("and setting another pre-recording", () => {
            let preRecording2: VoiceBroadcastPreRecording;

            beforeEach(() => {
                mocked(store.emit).mockClear();
                mocked(preRecording1.off).mockClear();
                preRecording2 = new VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
                store.setCurrent(preRecording2);
            });

            it("should deregister from the current pre-recording", () => {
                expect(preRecording1.off).toHaveBeenCalledWith("dismiss", expect.any(Function));
            });

            it("getCurrent() should return the new recording", () => {
                expect(store.getCurrent()).toBe(preRecording2);
            });

            it("should emit a changed event with the new recording", () => {
                expect(store.emit).toHaveBeenCalledWith("changed", preRecording2);
            });
        });
    });
});
