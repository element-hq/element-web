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
    EventTimelineSet,
    EventType,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    RelationType,
    Room,
} from "matrix-js-sdk/src/matrix";
import { Relations } from "matrix-js-sdk/src/models/relations";

import { uploadFile } from "../../../src/ContentMessages";
import { IEncryptedFile } from "../../../src/customisations/models/IMediaEventContent";
import { createVoiceMessageContent } from "../../../src/utils/createVoiceMessageContent";
import {
    createVoiceBroadcastRecorder,
    getChunkLength,
    getMaxBroadcastLength,
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecorder,
    VoiceBroadcastRecorderEvent,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
} from "../../../src/voice-broadcast";
import { mkEvent, mkStubRoom, stubClient } from "../../test-utils";
import dis from "../../../src/dispatcher/dispatcher";
import { VoiceRecording } from "../../../src/audio/VoiceRecording";

jest.mock("../../../src/voice-broadcast/audio/VoiceBroadcastRecorder", () => ({
    ...(jest.requireActual("../../../src/voice-broadcast/audio/VoiceBroadcastRecorder") as object),
    createVoiceBroadcastRecorder: jest.fn(),
}));

// mock VoiceRecording because it contains all the audio APIs
jest.mock("../../../src/audio/VoiceRecording", () => ({
    VoiceRecording: jest.fn().mockReturnValue({
        disableMaxLength: jest.fn(),
        liveData: {
            onUpdate: jest.fn(),
        },
        off: jest.fn(),
        on: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        contentType: "audio/ogg",
    }),
}));

jest.mock("../../../src/ContentMessages", () => ({
    uploadFile: jest.fn(),
}));

jest.mock("../../../src/utils/createVoiceMessageContent", () => ({
    createVoiceMessageContent: jest.fn(),
}));

describe("VoiceBroadcastRecording", () => {
    const roomId = "!room:example.com";
    const uploadedUrl = "mxc://example.com/vb";
    const uploadedFile = { file: true } as unknown as IEncryptedFile;
    const maxLength = getMaxBroadcastLength();
    let room: Room;
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let voiceBroadcastRecording: VoiceBroadcastRecording;
    let onStateChanged: (state: VoiceBroadcastInfoState) => void;
    let voiceBroadcastRecorder: VoiceBroadcastRecorder;

    const mkVoiceBroadcastInfoEvent = (content: VoiceBroadcastInfoEventContent) => {
        return mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            user: client.getUserId(),
            room: roomId,
            content,
        });
    };

    const setUpVoiceBroadcastRecording = () => {
        voiceBroadcastRecording = new VoiceBroadcastRecording(infoEvent, client);
        voiceBroadcastRecording.on(VoiceBroadcastRecordingEvent.StateChanged, onStateChanged);
        jest.spyOn(voiceBroadcastRecording, "destroy");
        jest.spyOn(voiceBroadcastRecording, "emit");
        jest.spyOn(voiceBroadcastRecording, "removeAllListeners");
    };

    const itShouldBeInState = (state: VoiceBroadcastInfoState) => {
        it(`should be in state stopped ${state}`, () => {
            expect(voiceBroadcastRecording.getState()).toBe(state);
        });
    };

    const itShouldSendAnInfoEvent = (state: VoiceBroadcastInfoState, lastChunkSequence: number) => {
        it(`should send a ${state} info event`, () => {
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                VoiceBroadcastInfoEventType,
                {
                    device_id: client.getDeviceId(),
                    state,
                    last_chunk_sequence: lastChunkSequence,
                    ["m.relates_to"]: {
                        rel_type: RelationType.Reference,
                        event_id: infoEvent.getId(),
                    },
                } as VoiceBroadcastInfoEventContent,
                client.getUserId(),
            );
        });
    };

    const itShouldSendAVoiceMessage = (data: number[], size: number, duration: number, sequence: number) => {
        // events contain milliseconds
        duration *= 1000;

        it("should send a voice message", () => {
            expect(uploadFile).toHaveBeenCalledWith(
                client,
                roomId,
                new Blob([new Uint8Array(data)], { type: voiceBroadcastRecorder.contentType }),
            );

            expect(mocked(client.sendMessage)).toHaveBeenCalledWith(roomId, {
                body: "Voice message",
                file: {
                    file: true,
                },
                info: {
                    duration,
                    mimetype: "audio/ogg",
                    size,
                },
                ["m.relates_to"]: {
                    event_id: infoEvent.getId(),
                    rel_type: "m.reference",
                },
                msgtype: "m.audio",
                ["org.matrix.msc1767.audio"]: {
                    duration,
                    waveform: undefined,
                },
                ["org.matrix.msc1767.file"]: {
                    file: {
                        file: true,
                    },
                    mimetype: "audio/ogg",
                    name: "Voice message.ogg",
                    size,
                    url: "mxc://example.com/vb",
                },
                ["org.matrix.msc1767.text"]: "Voice message",
                ["org.matrix.msc3245.voice"]: {},
                url: "mxc://example.com/vb",
                ["io.element.voice_broadcast_chunk"]: {
                    sequence,
                },
            });
        });
    };

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom(roomId, "Test Room", client);
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) {
                return room;
            }
        });
        onStateChanged = jest.fn();
        voiceBroadcastRecorder = new VoiceBroadcastRecorder(new VoiceRecording(), getChunkLength());
        jest.spyOn(voiceBroadcastRecorder, "start");
        jest.spyOn(voiceBroadcastRecorder, "stop");
        jest.spyOn(voiceBroadcastRecorder, "destroy");
        mocked(createVoiceBroadcastRecorder).mockReturnValue(voiceBroadcastRecorder);

        mocked(uploadFile).mockResolvedValue({
            url: uploadedUrl,
            file: uploadedFile,
        });

        mocked(createVoiceMessageContent).mockImplementation(
            (
                mxc: string,
                mimetype: string,
                duration: number,
                size: number,
                file?: IEncryptedFile,
                waveform?: number[],
            ) => {
                return {
                    body: "Voice message",
                    msgtype: MsgType.Audio,
                    url: mxc,
                    file,
                    info: {
                        duration,
                        mimetype,
                        size,
                    },
                    ["org.matrix.msc1767.text"]: "Voice message",
                    ["org.matrix.msc1767.file"]: {
                        url: mxc,
                        file,
                        name: "Voice message.ogg",
                        mimetype,
                        size,
                    },
                    ["org.matrix.msc1767.audio"]: {
                        duration,
                        // https://github.com/matrix-org/matrix-doc/pull/3246
                        waveform,
                    },
                    ["org.matrix.msc3245.voice"]: {}, // No content, this is a rendering hint
                };
            },
        );
    });

    afterEach(() => {
        voiceBroadcastRecording.off(VoiceBroadcastRecordingEvent.StateChanged, onStateChanged);
    });

    describe("when created for a Voice Broadcast Info without relations", () => {
        beforeEach(() => {
            infoEvent = mkVoiceBroadcastInfoEvent({
                device_id: client.getDeviceId(),
                state: VoiceBroadcastInfoState.Started,
            });
            setUpVoiceBroadcastRecording();
        });

        it("should be in Started state", () => {
            expect(voiceBroadcastRecording.getState()).toBe(VoiceBroadcastInfoState.Started);
        });

        describe("and calling stop", () => {
            beforeEach(() => {
                voiceBroadcastRecording.stop();
            });

            itShouldSendAnInfoEvent(VoiceBroadcastInfoState.Stopped, 0);
            itShouldBeInState(VoiceBroadcastInfoState.Stopped);

            it("should emit a stopped state changed event", () => {
                expect(onStateChanged).toHaveBeenCalledWith(VoiceBroadcastInfoState.Stopped);
            });
        });

        describe("and calling start", () => {
            beforeEach(async () => {
                await voiceBroadcastRecording.start();
            });

            it("should start the recorder", () => {
                expect(voiceBroadcastRecorder.start).toHaveBeenCalled();
            });

            describe("and the info event is redacted", () => {
                beforeEach(() => {
                    infoEvent.emit(MatrixEventEvent.BeforeRedaction, null, null);
                });

                itShouldBeInState(VoiceBroadcastInfoState.Stopped);

                it("should destroy the recording", () => {
                    expect(voiceBroadcastRecording.destroy).toHaveBeenCalled();
                });
            });

            describe("and receiving a call action", () => {
                beforeEach(() => {
                    dis.dispatch(
                        {
                            action: "call_state",
                        },
                        true,
                    );
                });

                itShouldBeInState(VoiceBroadcastInfoState.Paused);
            });

            describe("and a chunk time update occurs", () => {
                beforeEach(() => {
                    voiceBroadcastRecorder.emit(VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, 10);
                });

                it("should update time left", () => {
                    expect(voiceBroadcastRecording.getTimeLeft()).toBe(maxLength - 10);
                    expect(voiceBroadcastRecording.emit).toHaveBeenCalledWith(
                        VoiceBroadcastRecordingEvent.TimeLeftChanged,
                        maxLength - 10,
                    );
                });

                describe("and a chunk time update occurs, that would increase time left", () => {
                    beforeEach(() => {
                        mocked(voiceBroadcastRecording.emit).mockClear();
                        voiceBroadcastRecorder.emit(VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, 5);
                    });

                    it("should not change time left", () => {
                        expect(voiceBroadcastRecording.getTimeLeft()).toBe(maxLength - 10);
                        expect(voiceBroadcastRecording.emit).not.toHaveBeenCalled();
                    });
                });
            });

            describe("and a chunk has been recorded", () => {
                beforeEach(async () => {
                    voiceBroadcastRecorder.emit(VoiceBroadcastRecorderEvent.ChunkRecorded, {
                        buffer: new Uint8Array([1, 2, 3]),
                        length: 23,
                    });
                });

                itShouldSendAVoiceMessage([1, 2, 3], 3, 23, 1);

                describe("and another chunk has been recorded, that exceeds the max time", () => {
                    beforeEach(() => {
                        mocked(voiceBroadcastRecorder.stop).mockResolvedValue({
                            buffer: new Uint8Array([23, 24, 25]),
                            length: getMaxBroadcastLength(),
                        });
                        voiceBroadcastRecorder.emit(
                            VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated,
                            getMaxBroadcastLength(),
                        );
                    });

                    itShouldBeInState(VoiceBroadcastInfoState.Stopped);
                    itShouldSendAVoiceMessage([23, 24, 25], 3, getMaxBroadcastLength(), 2);
                    itShouldSendAnInfoEvent(VoiceBroadcastInfoState.Stopped, 2);
                });
            });

            describe("and calling stop", () => {
                beforeEach(async () => {
                    mocked(voiceBroadcastRecorder.stop).mockResolvedValue({
                        buffer: new Uint8Array([4, 5, 6]),
                        length: 42,
                    });
                    await voiceBroadcastRecording.stop();
                });

                itShouldSendAVoiceMessage([4, 5, 6], 3, 42, 1);
                itShouldSendAnInfoEvent(VoiceBroadcastInfoState.Stopped, 1);
            });

            describe.each([
                ["pause", async () => voiceBroadcastRecording.pause()],
                ["toggle", async () => voiceBroadcastRecording.toggle()],
            ])("and calling %s", (_case: string, action: Function) => {
                beforeEach(async () => {
                    await action();
                });

                itShouldBeInState(VoiceBroadcastInfoState.Paused);
                itShouldSendAnInfoEvent(VoiceBroadcastInfoState.Paused, 0);

                it("should stop the recorder", () => {
                    expect(mocked(voiceBroadcastRecorder.stop)).toHaveBeenCalled();
                });

                it("should emit a paused state changed event", () => {
                    expect(onStateChanged).toHaveBeenCalledWith(VoiceBroadcastInfoState.Paused);
                });
            });

            describe("and calling destroy", () => {
                beforeEach(() => {
                    voiceBroadcastRecording.destroy();
                });

                it("should stop the recorder and remove all listeners", () => {
                    expect(mocked(voiceBroadcastRecorder.stop)).toHaveBeenCalled();
                    expect(mocked(voiceBroadcastRecorder.destroy)).toHaveBeenCalled();
                    expect(mocked(voiceBroadcastRecording.removeAllListeners)).toHaveBeenCalled();
                });
            });
        });

        describe("and it is in paused state", () => {
            beforeEach(async () => {
                await voiceBroadcastRecording.pause();
            });

            describe.each([
                ["resume", async () => voiceBroadcastRecording.resume()],
                ["toggle", async () => voiceBroadcastRecording.toggle()],
            ])("and calling %s", (_case: string, action: Function) => {
                beforeEach(async () => {
                    await action();
                });

                itShouldBeInState(VoiceBroadcastInfoState.Resumed);
                itShouldSendAnInfoEvent(VoiceBroadcastInfoState.Resumed, 0);

                it("should start the recorder", () => {
                    expect(mocked(voiceBroadcastRecorder.start)).toHaveBeenCalled();
                });

                it(`should emit a ${VoiceBroadcastInfoState.Resumed} state changed event`, () => {
                    expect(onStateChanged).toHaveBeenCalledWith(VoiceBroadcastInfoState.Resumed);
                });
            });
        });
    });

    describe("when created for a Voice Broadcast Info with a Stopped relation", () => {
        beforeEach(() => {
            infoEvent = mkVoiceBroadcastInfoEvent({
                device_id: client.getDeviceId(),
                state: VoiceBroadcastInfoState.Started,
                chunk_length: 120,
            });

            const relationsContainer = {
                getRelations: jest.fn(),
            } as unknown as Relations;
            mocked(relationsContainer.getRelations).mockReturnValue([
                mkVoiceBroadcastInfoEvent({
                    device_id: client.getDeviceId(),
                    state: VoiceBroadcastInfoState.Stopped,
                    ["m.relates_to"]: {
                        rel_type: RelationType.Reference,
                        event_id: infoEvent.getId(),
                    },
                }),
            ]);

            const timelineSet = {
                relations: {
                    getChildEventsForEvent: jest
                        .fn()
                        .mockImplementation(
                            (eventId: string, relationType: RelationType | string, eventType: EventType | string) => {
                                if (
                                    eventId === infoEvent.getId() &&
                                    relationType === RelationType.Reference &&
                                    eventType === VoiceBroadcastInfoEventType
                                ) {
                                    return relationsContainer;
                                }
                            },
                        ),
                },
            } as unknown as EventTimelineSet;
            mocked(room.getUnfilteredTimelineSet).mockReturnValue(timelineSet);

            setUpVoiceBroadcastRecording();
        });

        it("should be in Stopped state", () => {
            expect(voiceBroadcastRecording.getState()).toBe(VoiceBroadcastInfoState.Stopped);
        });
    });
});
