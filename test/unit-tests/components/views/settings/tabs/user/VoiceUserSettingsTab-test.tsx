/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { fireEvent, render, screen } from "jest-matrix-react";
import { logger } from "matrix-js-sdk/src/logger";

import VoiceUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/VoiceUserSettingsTab";
import MediaDeviceHandler, {
    type IMediaDevices,
    MediaDeviceKindEnum,
} from "../../../../../../../src/MediaDeviceHandler";
import { flushPromises } from "../../../../../../test-utils";

jest.mock("../../../../../../../src/MediaDeviceHandler");
const MediaDeviceHandlerMock = mocked(MediaDeviceHandler);

describe("<VoiceUserSettingsTab />", () => {
    const getComponent = (): React.ReactElement => <VoiceUserSettingsTab />;

    const audioIn1 = {
        deviceId: "1",
        groupId: "g1",
        kind: MediaDeviceKindEnum.AudioInput,
        label: "Audio input test 1",
    };
    const videoIn1 = {
        deviceId: "2",
        groupId: "g1",
        kind: MediaDeviceKindEnum.VideoInput,
        label: "Video input test 1",
    };
    const videoIn2 = {
        deviceId: "3",
        groupId: "g1",
        kind: MediaDeviceKindEnum.VideoInput,
        label: "Video input test 2",
    };
    const defaultMediaDevices = {
        [MediaDeviceKindEnum.AudioOutput]: [],
        [MediaDeviceKindEnum.AudioInput]: [audioIn1],
        [MediaDeviceKindEnum.VideoInput]: [videoIn1, videoIn2],
    } as unknown as IMediaDevices;

    beforeEach(() => {
        jest.clearAllMocks();
        MediaDeviceHandlerMock.hasAnyLabeledDevices.mockResolvedValue(true);
        MediaDeviceHandlerMock.getDevices.mockResolvedValue(defaultMediaDevices);
        MediaDeviceHandlerMock.getVideoInput.mockReturnValue(videoIn1.deviceId);

        // @ts-ignore bad mocking
        MediaDeviceHandlerMock.instance = { setDevice: jest.fn().mockResolvedValue(undefined) };
    });

    describe("devices", () => {
        it("renders dropdowns for input devices", async () => {
            render(getComponent());

            await expect(screen.findByLabelText("Microphone")).resolves.toHaveDisplayValue(audioIn1.label);
            await expect(screen.findByLabelText("Camera")).resolves.toHaveDisplayValue(videoIn1.label);
        });

        it("updates device", async () => {
            render(getComponent());
            await flushPromises();

            fireEvent.change(await screen.findByLabelText("Camera"), { target: { value: videoIn2.deviceId } });

            expect(MediaDeviceHandlerMock.instance.setDevice).toHaveBeenCalledWith(
                videoIn2.deviceId,
                MediaDeviceKindEnum.VideoInput,
            );

            expect(screen.getByLabelText("Camera")).toHaveDisplayValue(videoIn2.label);
        });

        it("logs and resets device when update fails", async () => {
            // stub to avoid littering console with expected error
            jest.spyOn(logger, "error").mockImplementation(() => {});
            MediaDeviceHandlerMock.instance.setDevice.mockRejectedValue("oups!");
            render(getComponent());
            await flushPromises();

            fireEvent.change(screen.getByLabelText("Camera"), { target: { value: videoIn2.deviceId } });

            expect(MediaDeviceHandlerMock.instance.setDevice).toHaveBeenCalledWith(
                videoIn2.deviceId,
                MediaDeviceKindEnum.VideoInput,
            );

            expect(screen.getByLabelText("Camera")).toHaveDisplayValue(videoIn2.label);

            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith("Failed to set device videoinput: 3");
            // reset to original
            expect(screen.getByLabelText("Camera")).toHaveDisplayValue(videoIn1.label);
        });

        it("does not render dropdown when no devices exist for type", async () => {
            render(getComponent());
            await flushPromises();

            expect(screen.getByText("No Audio Outputs detected")).toBeInTheDocument();
            expect(screen.queryByLabelText("Audio Output")).not.toBeInTheDocument();
        });
    });

    it("renders audio processing settings", () => {
        const { getByTestId } = render(getComponent());
        expect(getByTestId("voice-auto-gain")).toBeTruthy();
        expect(getByTestId("voice-noise-suppression")).toBeTruthy();
        expect(getByTestId("voice-echo-cancellation")).toBeTruthy();
    });

    it("sets and displays audio processing settings", () => {
        MediaDeviceHandlerMock.getAudioAutoGainControl.mockReturnValue(false);
        MediaDeviceHandlerMock.getAudioEchoCancellation.mockReturnValue(true);
        MediaDeviceHandlerMock.getAudioNoiseSuppression.mockReturnValue(false);

        const { getByRole } = render(getComponent());

        getByRole("switch", { name: "Automatically adjust the microphone volume" }).click();
        getByRole("switch", { name: "Noise suppression" }).click();
        getByRole("switch", { name: "Echo cancellation" }).click();

        expect(MediaDeviceHandler.setAudioAutoGainControl).toHaveBeenCalledWith(true);
        expect(MediaDeviceHandler.setAudioEchoCancellation).toHaveBeenCalledWith(false);
        expect(MediaDeviceHandler.setAudioNoiseSuppression).toHaveBeenCalledWith(true);
    });
});
