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
import { IEncryptedFile, UploadOpts, MatrixClient } from "matrix-js-sdk/src/matrix";

import { createVoiceMessageRecording, VoiceMessageRecording } from "../../src/audio/VoiceMessageRecording";
import { RecordingState, VoiceRecording } from "../../src/audio/VoiceRecording";
import { uploadFile } from "../../src/ContentMessages";
import { stubClient } from "../test-utils";
import { Playback } from "../../src/audio/Playback";

jest.mock("../../src/ContentMessages", () => ({
    uploadFile: jest.fn(),
}));

jest.mock("../../src/audio/Playback", () => ({
    Playback: jest.fn(),
}));

describe("VoiceMessageRecording", () => {
    const roomId = "!room:example.com";
    const contentType = "test content type";
    const durationSeconds = 23;
    const testBuf = new Uint8Array([1, 2, 3]);
    const testAmplitudes = [4, 5, 6];

    let voiceRecording: VoiceRecording;
    let voiceMessageRecording: VoiceMessageRecording;
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
        voiceRecording = {
            contentType,
            durationSeconds,
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
            isRecording: true,
            isSupported: true,
            liveData: jest.fn(),
            amplitudes: testAmplitudes,
        } as unknown as VoiceRecording;
        voiceMessageRecording = new VoiceMessageRecording(client, voiceRecording);
    });

    it("hasRecording should return false", () => {
        expect(voiceMessageRecording.hasRecording).toBe(false);
    });

    it("createVoiceMessageRecording should return a VoiceMessageRecording", () => {
        expect(createVoiceMessageRecording(client)).toBeInstanceOf(VoiceMessageRecording);
    });

    it("durationSeconds should return the VoiceRecording value", () => {
        expect(voiceMessageRecording.durationSeconds).toBe(durationSeconds);
    });

    it("contentType should return the VoiceRecording value", () => {
        expect(voiceMessageRecording.contentType).toBe(contentType);
    });

    it.each([true, false])("isRecording should return %s from VoiceRecording", (value: boolean) => {
        // @ts-ignore
        voiceRecording.isRecording = value;
        expect(voiceMessageRecording.isRecording).toBe(value);
    });

    it.each([true, false])("isSupported should return %s from VoiceRecording", (value: boolean) => {
        // @ts-ignore
        voiceRecording.isSupported = value;
        expect(voiceMessageRecording.isSupported).toBe(value);
    });

    it("should return liveData from VoiceRecording", () => {
        expect(voiceMessageRecording.liveData).toBe(voiceRecording.liveData);
    });

    it("start should forward the call to VoiceRecording.start", async () => {
        await voiceMessageRecording.start();
        expect(voiceRecording.start).toHaveBeenCalled();
    });

    it("on should forward the call to VoiceRecording", () => {
        const callback = () => {};
        const result = voiceMessageRecording.on("test on", callback);
        expect(voiceRecording.on).toHaveBeenCalledWith("test on", callback);
        expect(result).toBe(voiceMessageRecording);
    });

    it("off should forward the call to VoiceRecording", () => {
        const callback = () => {};
        const result = voiceMessageRecording.off("test off", callback);
        expect(voiceRecording.off).toHaveBeenCalledWith("test off", callback);
        expect(result).toBe(voiceMessageRecording);
    });

    it("emit should forward the call to VoiceRecording", () => {
        voiceMessageRecording.emit("test emit", 42);
        expect(voiceRecording.emit).toHaveBeenCalledWith("test emit", 42);
    });

    it("upload should raise an error", async () => {
        await expect(voiceMessageRecording.upload(roomId)).rejects.toThrow("No recording available to upload");
    });

    describe("when the first data has been received", () => {
        const uploadUrl = "https://example.com/content123";
        const encryptedFile = {} as unknown as IEncryptedFile;

        beforeEach(() => {
            voiceRecording.onDataAvailable!(testBuf);
        });

        it("contentLength should return the buffer length", () => {
            expect(voiceMessageRecording.contentLength).toBe(testBuf.length);
        });

        it("stop should return a copy of the data buffer", async () => {
            const result = await voiceMessageRecording.stop();
            expect(voiceRecording.stop).toHaveBeenCalled();
            expect(result).toEqual(testBuf);
        });

        it("hasRecording should return true", () => {
            expect(voiceMessageRecording.hasRecording).toBe(true);
        });

        describe("upload", () => {
            let uploadFileClient: MatrixClient | null;
            let uploadFileRoomId: string | null;
            let uploadBlob: Blob | null;

            beforeEach(() => {
                uploadFileClient = null;
                uploadFileRoomId = null;
                uploadBlob = null;

                mocked(uploadFile).mockImplementation(
                    (
                        matrixClient: MatrixClient,
                        roomId: string,
                        file: File | Blob,
                        _progressHandler?: UploadOpts["progressHandler"],
                    ): Promise<{ url?: string; file?: IEncryptedFile }> => {
                        uploadFileClient = matrixClient;
                        uploadFileRoomId = roomId;
                        uploadBlob = file;
                        // @ts-ignore
                        return Promise.resolve({
                            url: uploadUrl,
                            file: encryptedFile,
                        });
                    },
                );
            });

            it("should upload the file and trigger the upload events", async () => {
                const result = await voiceMessageRecording.upload(roomId);
                expect(voiceRecording.emit).toHaveBeenNthCalledWith(1, RecordingState.Uploading);
                expect(voiceRecording.emit).toHaveBeenNthCalledWith(2, RecordingState.Uploaded);

                expect(result.mxc).toBe(uploadUrl);
                expect(result.encrypted).toBe(encryptedFile);

                expect(mocked(uploadFile)).toHaveBeenCalled();
                expect(uploadFileClient).toBe(client);
                expect(uploadFileRoomId).toBe(roomId);
                expect(uploadBlob?.type).toBe(contentType);
                const blobArray = await uploadBlob!.arrayBuffer();
                expect(new Uint8Array(blobArray)).toEqual(testBuf);
            });

            it("should reuse the result", async () => {
                const result1 = await voiceMessageRecording.upload(roomId);
                const result2 = await voiceMessageRecording.upload(roomId);
                expect(result1).toBe(result2);
            });
        });

        describe("getPlayback", () => {
            beforeEach(() => {
                mocked(Playback).mockImplementation((buf: ArrayBuffer, seedWaveform): any => {
                    expect(new Uint8Array(buf)).toEqual(testBuf);
                    expect(seedWaveform).toEqual(testAmplitudes);
                    return {} as Playback;
                });
            });

            it("should return a Playback with the data", () => {
                voiceMessageRecording.getPlayback();
                expect(mocked(Playback)).toHaveBeenCalled();
            });

            it("should reuse the result", () => {
                const playback1 = voiceMessageRecording.getPlayback();
                const playback2 = voiceMessageRecording.getPlayback();
                expect(playback1).toBe(playback2);
            });
        });
    });
});
