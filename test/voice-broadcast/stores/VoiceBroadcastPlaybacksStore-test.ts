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
import {
    MatrixClient,
    MatrixEvent,
    Room,
} from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastInfoEventType,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlaybacksStoreEvent,
} from "../../../src/voice-broadcast";
import { mkEvent, mkStubRoom, stubClient } from "../../test-utils";

jest.mock("../../../src/voice-broadcast/models/VoiceBroadcastPlayback", () => ({
    ...jest.requireActual("../../../src/voice-broadcast/models/VoiceBroadcastPlayback") as object,
    VoiceBroadcastPlayback: jest.fn().mockImplementation((infoEvent: MatrixEvent) => ({ infoEvent })),
}));

describe("VoiceBroadcastPlaybacksStore", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let playbacks: VoiceBroadcastPlaybacksStore;
    let onCurrentChanged: (playback: VoiceBroadcastPlayback) => void;

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom(roomId, "test room", client);
        mocked(client.getRoom).mockImplementation((roomId: string) => {
            if (roomId === room.roomId) {
                return room;
            }
        });
        infoEvent = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            user: client.getUserId(),
            room: roomId,
            content: {},
        });
        playback = {
            infoEvent,
        } as unknown as VoiceBroadcastPlayback;
        playbacks = new VoiceBroadcastPlaybacksStore();
        onCurrentChanged = jest.fn();
        playbacks.on(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, onCurrentChanged);
    });

    afterEach(() => {
        playbacks.off(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, onCurrentChanged);
    });

    describe("when setting a current Voice Broadcast playback", () => {
        beforeEach(() => {
            playbacks.setCurrent(playback);
        });

        it("should return it as current", () => {
            expect(playbacks.getCurrent()).toBe(playback);
        });

        it("should return it by id", () => {
            expect(playbacks.getByInfoEvent(infoEvent, client)).toBe(playback);
        });

        it("should emit a CurrentChanged event", () => {
            expect(onCurrentChanged).toHaveBeenCalledWith(playback);
        });

        describe("and setting the same again", () => {
            beforeEach(() => {
                mocked(onCurrentChanged).mockClear();
                playbacks.setCurrent(playback);
            });

            it("should not emit a CurrentChanged event", () => {
                expect(onCurrentChanged).not.toHaveBeenCalled();
            });
        });
    });

    describe("getByInfoEventId", () => {
        let returnedPlayback: VoiceBroadcastPlayback;

        describe("when retrieving a known playback", () => {
            beforeEach(() => {
                playbacks.setCurrent(playback);
                returnedPlayback = playbacks.getByInfoEvent(infoEvent, client);
            });

            it("should return the playback", () => {
                expect(returnedPlayback).toBe(playback);
            });
        });

        describe("when retrieving an unknown playback", () => {
            beforeEach(() => {
                returnedPlayback = playbacks.getByInfoEvent(infoEvent, client);
            });

            it("should return the playback", () => {
                expect(returnedPlayback).toEqual({
                    infoEvent,
                });
            });
        });
    });
});
