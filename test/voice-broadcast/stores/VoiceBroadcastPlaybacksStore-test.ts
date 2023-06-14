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
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlaybacksStoreEvent,
    VoiceBroadcastPlaybackState,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { mkStubRoom, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

describe("VoiceBroadcastPlaybacksStore", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let userId: string;
    let deviceId: string;
    let room: Room;
    let infoEvent1: MatrixEvent;
    let infoEvent2: MatrixEvent;
    let playback1: VoiceBroadcastPlayback;
    let playback2: VoiceBroadcastPlayback;
    let playbacks: VoiceBroadcastPlaybacksStore;
    let onCurrentChanged: (playback: VoiceBroadcastPlayback | null) => void;

    beforeEach(() => {
        client = stubClient();
        userId = client.getUserId() || "";
        deviceId = client.getDeviceId() || "";
        mocked(client.relations).mockClear();
        mocked(client.relations).mockResolvedValue({ events: [] });

        room = mkStubRoom(roomId, "test room", client);
        mocked(client.getRoom).mockImplementation((roomId: string): Room | null => {
            if (roomId === room.roomId) {
                return room;
            }

            return null;
        });

        infoEvent1 = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Started, userId, deviceId);
        infoEvent2 = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Started, userId, deviceId);
        const recordings = new VoiceBroadcastRecordingsStore();
        playback1 = new VoiceBroadcastPlayback(infoEvent1, client, recordings);
        jest.spyOn(playback1, "off");
        playback2 = new VoiceBroadcastPlayback(infoEvent2, client, recordings);
        jest.spyOn(playback2, "off");

        playbacks = new VoiceBroadcastPlaybacksStore(recordings);
        jest.spyOn(playbacks, "removeAllListeners");
        onCurrentChanged = jest.fn();
        playbacks.on(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, onCurrentChanged);
    });

    afterEach(() => {
        playbacks.off(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, onCurrentChanged);
    });

    describe("when setting a current Voice Broadcast playback", () => {
        beforeEach(() => {
            playbacks.setCurrent(playback1);
        });

        it("should return it as current", () => {
            expect(playbacks.getCurrent()).toBe(playback1);
        });

        it("should return it by id", () => {
            expect(playbacks.getByInfoEvent(infoEvent1, client)).toBe(playback1);
        });

        it("should emit a CurrentChanged event", () => {
            expect(onCurrentChanged).toHaveBeenCalledWith(playback1);
        });

        describe("and setting the same again", () => {
            beforeEach(() => {
                mocked(onCurrentChanged).mockClear();
                playbacks.setCurrent(playback1);
            });

            it("should not emit a CurrentChanged event", () => {
                expect(onCurrentChanged).not.toHaveBeenCalled();
            });
        });

        describe("and setting another playback and start both", () => {
            beforeEach(() => {
                playbacks.setCurrent(playback2);
                playback1.start();
                playback2.start();
            });

            it("should set playback1 to paused", () => {
                expect(playback1.getState()).toBe(VoiceBroadcastPlaybackState.Paused);
            });

            it("should set playback2 to buffering", () => {
                // buffering because there are no chunks, yet
                expect(playback2.getState()).toBe(VoiceBroadcastPlaybackState.Buffering);
            });

            describe("and calling destroy", () => {
                beforeEach(() => {
                    playbacks.destroy();
                });

                it("should remove all listeners", () => {
                    expect(playbacks.removeAllListeners).toHaveBeenCalled();
                });

                it("should deregister the listeners on the playbacks", () => {
                    expect(playback1.off).toHaveBeenCalledWith(
                        VoiceBroadcastPlaybackEvent.StateChanged,
                        expect.any(Function),
                    );
                    expect(playback2.off).toHaveBeenCalledWith(
                        VoiceBroadcastPlaybackEvent.StateChanged,
                        expect.any(Function),
                    );
                });
            });
        });
    });

    describe("getByInfoEventId", () => {
        let returnedPlayback: VoiceBroadcastPlayback;

        describe("when retrieving a known playback", () => {
            beforeEach(() => {
                playbacks.setCurrent(playback1);
                returnedPlayback = playbacks.getByInfoEvent(infoEvent1, client);
            });

            it("should return the playback", () => {
                expect(returnedPlayback).toBe(playback1);
            });
        });

        describe("when retrieving an unknown playback", () => {
            beforeEach(() => {
                returnedPlayback = playbacks.getByInfoEvent(infoEvent1, client);
            });

            it("should return the playback", () => {
                expect(returnedPlayback.infoEvent).toBe(infoEvent1);
            });
        });
    });
});
