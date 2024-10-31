/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, ISendEventResponse, MatrixClient, MatrixEvent, Room, SyncState } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../src/Modal";
import {
    startNewVoiceBroadcastRecording,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlayback,
} from "../../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

jest.mock("../../../../src/voice-broadcast/models/VoiceBroadcastRecording", () => ({
    VoiceBroadcastRecording: jest.fn(),
}));

jest.mock("../../../../src/Modal");

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
