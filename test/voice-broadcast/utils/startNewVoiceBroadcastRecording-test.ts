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
import { EventType, ISendEventResponse, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";

import Modal from "../../../src/Modal";
import {
    startNewVoiceBroadcastRecording,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlayback,
} from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

jest.mock("../../../src/voice-broadcast/models/VoiceBroadcastRecording", () => ({
    VoiceBroadcastRecording: jest.fn(),
}));

jest.mock("../../../src/Modal");

describe("startNewVoiceBroadcastRecording", () => {
    const roomId = "!room:example.com";
    const otherUserId = "@other:example.com";
    let client: MatrixClient;
    let playbacksStore: VoiceBroadcastPlaybacksStore;
    let recordingsStore: VoiceBroadcastRecordingsStore;
    let room: Room;
    let infoEvent: MatrixEvent;
    let otherEvent: MatrixEvent;
    let result: VoiceBroadcastRecording | null;

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId()!);
        jest.spyOn(room.currentState, "maySendStateEvent");

        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) {
                return room;
            }

            return null;
        });
        mocked(client.sendStateEvent).mockImplementation(
            (sendRoomId: string, eventType: string, content: any, stateKey: string): Promise<ISendEventResponse> => {
                if (sendRoomId === roomId && eventType === VoiceBroadcastInfoEventType) {
                    return Promise.resolve({ event_id: infoEvent.getId()! });
                }

                throw new Error("Unexpected sendStateEvent call");
            },
        );

        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.getDeviceId()!,
        );
        otherEvent = mkEvent({
            event: true,
            type: EventType.RoomMember,
            content: {},
            user: client.getUserId()!,
            room: roomId,
            skey: "",
        });

        playbacksStore = new VoiceBroadcastPlaybacksStore(recordingsStore);
        recordingsStore = {
            setCurrent: jest.fn(),
            getCurrent: jest.fn(),
        } as unknown as VoiceBroadcastRecordingsStore;

        mocked(VoiceBroadcastRecording).mockImplementation((infoEvent: MatrixEvent, client: MatrixClient): any => {
            return {
                infoEvent,
                client,
                start: jest.fn(),
            } as unknown as VoiceBroadcastRecording;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("when trying to start a broadcast if there is no connection", () => {
        beforeEach(async () => {
            mocked(client.getSyncState).mockReturnValue(SyncState.Error);
            result = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
        });

        it("should show an info dialog and not start a recording", () => {
            expect(result).toBeNull();
            expect(Modal.createDialog).toMatchSnapshot();
        });
    });

    describe("when the current user is allowed to send voice broadcast info state events", () => {
        beforeEach(() => {
            mocked(room.currentState.maySendStateEvent).mockReturnValue(true);
        });

        describe("when currently listening to a broadcast and there is no recording", () => {
            let playback: VoiceBroadcastPlayback;

            beforeEach(() => {
                playback = new VoiceBroadcastPlayback(infoEvent, client, recordingsStore);
                jest.spyOn(playback, "pause");
                playbacksStore.setCurrent(playback);
            });

            it("should stop listen to the current broadcast and create a new recording", async () => {
                mocked(client.sendStateEvent).mockImplementation(
                    async (
                        _roomId: string,
                        _eventType: string,
                        _content: any,
                        _stateKey = "",
                    ): Promise<ISendEventResponse> => {
                        window.setTimeout(() => {
                            // emit state events after resolving the promise
                            room.currentState.setStateEvents([otherEvent]);
                            room.currentState.setStateEvents([infoEvent]);
                        }, 0);
                        return { event_id: infoEvent.getId()! };
                    },
                );
                const recording = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
                expect(recording).not.toBeNull();

                // expect to stop and clear the current playback
                expect(playback.pause).toHaveBeenCalled();
                expect(playbacksStore.getCurrent()).toBeNull();

                expect(client.sendStateEvent).toHaveBeenCalledWith(
                    roomId,
                    VoiceBroadcastInfoEventType,
                    {
                        chunk_length: 120,
                        device_id: client.getDeviceId(),
                        state: VoiceBroadcastInfoState.Started,
                    },
                    client.getUserId()!,
                );
                expect(recording!.infoEvent).toBe(infoEvent);
                expect(recording!.start).toHaveBeenCalled();
            });
        });

        describe("when there is already a current voice broadcast", () => {
            beforeEach(async () => {
                mocked(recordingsStore.getCurrent).mockReturnValue(new VoiceBroadcastRecording(infoEvent, client));

                result = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
            });

            it("should not start a voice broadcast", () => {
                expect(result).toBeNull();
            });

            it("should show an info dialog", () => {
                expect(Modal.createDialog).toMatchSnapshot();
            });
        });

        describe("when there already is a live broadcast of the current user in the room", () => {
            beforeEach(async () => {
                room.currentState.setStateEvents([
                    mkVoiceBroadcastInfoStateEvent(
                        roomId,
                        VoiceBroadcastInfoState.Resumed,
                        client.getUserId()!,
                        client.getDeviceId()!,
                    ),
                ]);

                result = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
            });

            it("should not start a voice broadcast", () => {
                expect(result).toBeNull();
            });

            it("should show an info dialog", () => {
                expect(Modal.createDialog).toMatchSnapshot();
            });
        });

        describe("when there already is a live broadcast of another user", () => {
            beforeEach(async () => {
                room.currentState.setStateEvents([
                    mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Resumed, otherUserId, "ASD123"),
                ]);

                result = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
            });

            it("should not start a voice broadcast", () => {
                expect(result).toBeNull();
            });

            it("should show an info dialog", () => {
                expect(Modal.createDialog).toMatchSnapshot();
            });
        });
    });

    describe("when the current user is not allowed to send voice broadcast info state events", () => {
        beforeEach(async () => {
            mocked(room.currentState.maySendStateEvent).mockReturnValue(false);
            result = await startNewVoiceBroadcastRecording(room, client, playbacksStore, recordingsStore);
        });

        it("should not start a voice broadcast", () => {
            expect(result).toBeNull();
        });

        it("should show an info dialog", () => {
            expect(Modal.createDialog).toMatchSnapshot();
        });
    });
});
