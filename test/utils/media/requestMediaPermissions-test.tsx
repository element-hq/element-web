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
import { logger } from "matrix-js-sdk/src/logger";
import { screen } from "@testing-library/react";

import { requestMediaPermissions } from "../../../src/utils/media/requestMediaPermissions";
import { flushPromises } from "../../test-utils";

describe("requestMediaPermissions", () => {
    let error: Error;
    const audioVideoStream = {} as MediaStream;
    const audioStream = {} as MediaStream;

    const itShouldLogTheErrorAndShowTheNoMediaPermissionsModal = () => {
        it("should log the error and show the »No media permissions« modal", () => {
            expect(logger.log).toHaveBeenCalledWith("Failed to list userMedia devices", error);
            screen.getByText("No media permissions");
        });
    };

    beforeEach(() => {
        error = new Error();
        jest.spyOn(logger, "log");
    });

    describe("when an audio and video device is available", () => {
        beforeEach(() => {
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
                async ({ audio, video }): Promise<MediaStream> => {
                    if (audio && video) return audioVideoStream;
                    return audioStream;
                },
            );
        });

        it("should return the audio/video stream", async () => {
            expect(await requestMediaPermissions()).toBe(audioVideoStream);
        });
    });

    describe("when calling with video = false and an audio device is available", () => {
        beforeEach(() => {
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
                async ({ audio, video }): Promise<MediaStream> => {
                    if (audio && !video) return audioStream;
                    return audioVideoStream;
                },
            );
        });

        it("should return the audio stream", async () => {
            expect(await requestMediaPermissions(false)).toBe(audioStream);
        });
    });

    describe("when only an audio stream is available", () => {
        beforeEach(() => {
            error.name = "NotFoundError";
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
                async ({ audio, video }): Promise<MediaStream> => {
                    if (audio && video) throw error;
                    if (audio) return audioStream;
                    return audioVideoStream;
                },
            );
        });

        it("should return the audio stream", async () => {
            expect(await requestMediaPermissions()).toBe(audioStream);
        });
    });

    describe("when no device is available", () => {
        beforeEach(async () => {
            error.name = "NotFoundError";
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(async (): Promise<MediaStream> => {
                throw error;
            });
            await requestMediaPermissions();
            // required for the modal to settle
            await flushPromises();
            await flushPromises();
        });

        itShouldLogTheErrorAndShowTheNoMediaPermissionsModal();
    });

    describe("when an Error is raised", () => {
        beforeEach(async () => {
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
                async ({ audio, video }): Promise<MediaStream> => {
                    if (audio && video) throw error;
                    return audioVideoStream;
                },
            );
            await requestMediaPermissions();
            // required for the modal to settle
            await flushPromises();
            await flushPromises();
        });

        itShouldLogTheErrorAndShowTheNoMediaPermissionsModal();
    });
});
