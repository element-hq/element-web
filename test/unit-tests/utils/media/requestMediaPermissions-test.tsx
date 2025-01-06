/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";
import { screen } from "jest-matrix-react";

import { requestMediaPermissions } from "../../../../src/utils/media/requestMediaPermissions";
import { flushPromises, useMockMediaDevices } from "../../../test-utils";

describe("requestMediaPermissions", () => {
    let error: Error;
    const audioVideoStream = {} as MediaStream;
    const audioStream = {} as MediaStream;

    const itShouldLogTheErrorAndShowTheNoMediaPermissionsModal = () => {
        it("should log the error and show the »No media permissions« modal", async () => {
            expect(logger.log).toHaveBeenCalledWith("Failed to list userMedia devices", error);
            await expect(screen.findByText("No media permissions")).resolves.toBeInTheDocument();
        });
    };

    beforeEach(() => {
        useMockMediaDevices();
        error = new Error();
        jest.spyOn(logger, "log");
    });

    describe("when an audio and video device is available", () => {
        beforeEach(() => {
            mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
                async ({ audio, video }: MediaStreamConstraints): Promise<MediaStream> => {
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
                async ({ audio, video }: MediaStreamConstraints): Promise<MediaStream> => {
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
                async ({ audio, video }: MediaStreamConstraints): Promise<MediaStream> => {
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
                async ({ audio, video }: MediaStreamConstraints): Promise<MediaStream> => {
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
