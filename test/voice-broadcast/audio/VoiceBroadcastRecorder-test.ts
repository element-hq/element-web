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
import { Optional } from "matrix-events-sdk";

import { VoiceRecording } from "../../../src/audio/VoiceRecording";
import SdkConfig from "../../../src/SdkConfig";
import { concat } from "../../../src/utils/arrays";
import {
    ChunkRecordedPayload,
    createVoiceBroadcastRecorder,
    VoiceBroadcastRecorder,
    VoiceBroadcastRecorderEvent,
} from "../../../src/voice-broadcast";

// mock VoiceRecording because it contains all the audio APIs
jest.mock("../../../src/audio/VoiceRecording", () => ({
    VoiceRecording: jest.fn().mockReturnValue({
        disableMaxLength: jest.fn(),
        emit: jest.fn(),
        liveData: {
            onUpdate: jest.fn(),
        },
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
    }),
}));

jest.mock("../../../src/settings/SettingsStore");

describe("VoiceBroadcastRecorder", () => {
    describe("createVoiceBroadcastRecorder", () => {
        beforeEach(() => {
            jest.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
                if (key === "voice_broadcast") {
                    return {
                        chunk_length: 1337,
                    };
                }
            });
        });

        afterEach(() => {
            mocked(SdkConfig.get).mockRestore();
        });

        it("should return a VoiceBroadcastRecorder instance with targetChunkLength from config", () => {
            const voiceBroadcastRecorder = createVoiceBroadcastRecorder();
            expect(voiceBroadcastRecorder).toBeInstanceOf(VoiceBroadcastRecorder);
            expect(voiceBroadcastRecorder.targetChunkLength).toBe(1337);
        });
    });

    describe("instance", () => {
        const chunkLength = 30;
        // 0... OpusHead
        const headers1 = new Uint8Array([...Array(28).fill(0), 79, 112, 117, 115, 72, 101, 97, 100]);
        // 0... OpusTags
        const headers2 = new Uint8Array([...Array(28).fill(0), 79, 112, 117, 115, 84, 97, 103, 115]);
        const chunk1 = new Uint8Array([5, 6]);
        const chunk2a = new Uint8Array([7, 8]);
        const chunk2b = new Uint8Array([9, 10]);
        const contentType = "test content type";

        let voiceRecording: VoiceRecording;
        let voiceBroadcastRecorder: VoiceBroadcastRecorder;
        let onChunkRecorded: (chunk: ChunkRecordedPayload) => void;

        const simulateFirstChunk = (): void => {
            // send headers in wrong order and multiple times to test robustness for that
            voiceRecording.onDataAvailable!(headers2);
            voiceRecording.onDataAvailable!(headers1);
            voiceRecording.onDataAvailable!(headers1);
            voiceRecording.onDataAvailable!(headers2);
            // set recorder seconds to something greater than the test chunk length of 30
            // @ts-ignore
            voiceRecording.recorderSeconds = 42;
            voiceRecording.onDataAvailable!(chunk1);
            voiceRecording.onDataAvailable!(headers1);
        };

        const expectOnFirstChunkRecorded = (): void => {
            expect(onChunkRecorded).toHaveBeenNthCalledWith(1, {
                buffer: concat(headers1, headers2, chunk1),
                length: 42,
            });
        };

        const itShouldNotEmitAChunkRecordedEvent = (): void => {
            it("should not emit a ChunkRecorded event", (): void => {
                expect(voiceRecording.emit).not.toHaveBeenCalledWith(
                    VoiceBroadcastRecorderEvent.ChunkRecorded,
                    expect.anything(),
                );
            });
        };

        beforeEach(() => {
            voiceRecording = new VoiceRecording();
            // @ts-ignore
            voiceRecording.recorderSeconds = 23;
            // @ts-ignore
            voiceRecording.contentType = contentType;

            voiceBroadcastRecorder = new VoiceBroadcastRecorder(voiceRecording, chunkLength);
            jest.spyOn(voiceBroadcastRecorder, "removeAllListeners");
            onChunkRecorded = jest.fn();
            voiceBroadcastRecorder.on(VoiceBroadcastRecorderEvent.ChunkRecorded, onChunkRecorded);
        });

        afterEach(() => {
            voiceBroadcastRecorder.destroy();
        });

        it("start should forward the call to VoiceRecording.start", async () => {
            await voiceBroadcastRecorder.start();
            expect(voiceRecording.start).toHaveBeenCalled();
        });

        describe("stop", () => {
            beforeEach(async () => {
                await voiceBroadcastRecorder.stop();
            });

            it("should forward the call to VoiceRecording.stop", async () => {
                expect(voiceRecording.stop).toHaveBeenCalled();
            });

            itShouldNotEmitAChunkRecordedEvent();
        });

        describe("when calling destroy", () => {
            beforeEach(() => {
                voiceBroadcastRecorder.destroy();
            });

            it("should call VoiceRecording.destroy", () => {
                expect(voiceRecording.destroy).toHaveBeenCalled();
            });

            it("should remove all listeners", () => {
                expect(voiceBroadcastRecorder.removeAllListeners).toHaveBeenCalled();
            });
        });

        it("contentType should return the value from VoiceRecording", () => {
            expect(voiceBroadcastRecorder.contentType).toBe(contentType);
        });

        describe("when the first header from recorder has been received", () => {
            beforeEach(() => {
                voiceRecording.onDataAvailable!(headers1);
            });

            itShouldNotEmitAChunkRecordedEvent();
        });

        describe("when the second header from recorder has been received", () => {
            beforeEach(() => {
                voiceRecording.onDataAvailable!(headers1);
                voiceRecording.onDataAvailable!(headers2);
            });

            itShouldNotEmitAChunkRecordedEvent();
        });

        describe("when a third page from recorder has been received", () => {
            beforeEach(() => {
                voiceRecording.onDataAvailable!(headers1);
                voiceRecording.onDataAvailable!(headers2);
                voiceRecording.onDataAvailable!(chunk1);
            });

            itShouldNotEmitAChunkRecordedEvent();

            describe("and calling stop", () => {
                let stopPayload: Optional<ChunkRecordedPayload>;

                beforeEach(async () => {
                    stopPayload = await voiceBroadcastRecorder.stop();
                });

                it("should return the remaining chunk", () => {
                    expect(stopPayload).toEqual({
                        buffer: concat(headers1, headers2, chunk1),
                        length: 23,
                    });
                });

                describe("and calling start again and receiving some data", () => {
                    beforeEach(() => {
                        simulateFirstChunk();
                    });

                    it("should emit the ChunkRecorded event for the first chunk", () => {
                        expectOnFirstChunkRecorded();
                    });
                });
            });

            describe("and calling stop() with recording.stop error)", () => {
                let stopPayload: Optional<ChunkRecordedPayload>;

                beforeEach(async () => {
                    mocked(voiceRecording.stop).mockRejectedValue("Error");
                    stopPayload = await voiceBroadcastRecorder.stop();
                });

                it("should return the remaining chunk", () => {
                    expect(stopPayload).toEqual({
                        buffer: concat(headers1, headers2, chunk1),
                        length: 23,
                    });
                });
            });
        });

        describe("when some chunks have been received", () => {
            beforeEach(() => {
                simulateFirstChunk();

                // simulate a second chunk
                voiceRecording.onDataAvailable!(chunk2a);

                // send headers again to test robustness for that
                voiceRecording.onDataAvailable!(headers2);

                // add another 30 seconds for the next chunk
                // @ts-ignore
                voiceRecording.recorderSeconds = 72;
                voiceRecording.onDataAvailable!(chunk2b);
            });

            it("should emit ChunkRecorded events", () => {
                expectOnFirstChunkRecorded();

                expect(onChunkRecorded).toHaveBeenNthCalledWith(2, {
                    buffer: concat(headers1, headers2, chunk2a, chunk2b),
                    length: 72 - 42, // 72 (position at second chunk) - 42 (position of first chunk)
                });
            });
        });
    });
});
