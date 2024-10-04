/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/
//

import React from "react";
import { act, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientEvent, MatrixClient, MatrixEvent, SyncState } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { mocked } from "jest-mock";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingPip,
} from "../../../../src/voice-broadcast";
import { flushPromises, stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../utils/test-utils";
import { requestMediaPermissions } from "../../../../src/utils/media/requestMediaPermissions";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../../src/MediaDeviceHandler";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";

jest.mock("../../../../src/dispatcher/dispatcher");
jest.mock("../../../../src/utils/media/requestMediaPermissions");

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: {room.name}</div>;
    }),
}));

// mock VoiceRecording because it contains all the audio APIs
jest.mock("../../../../src/audio/VoiceRecording", () => ({
    VoiceRecording: jest.fn().mockReturnValue({
        disableMaxLength: jest.fn(),
        liveData: {
            onUpdate: jest.fn(),
        },
        start: jest.fn(),
    }),
}));

describe("VoiceBroadcastRecordingPip", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let recording: VoiceBroadcastRecording;
    let renderResult: RenderResult;

    const renderPip = async (state: VoiceBroadcastInfoState) => {
        infoEvent = mkVoiceBroadcastInfoStateEvent(roomId, state, client.getUserId() || "", client.getDeviceId() || "");
        recording = new VoiceBroadcastRecording(infoEvent, client, state);
        jest.spyOn(recording, "pause");
        jest.spyOn(recording, "resume");
        renderResult = render(<VoiceBroadcastRecordingPip recording={recording} />);
        await act(async () => {
            flushPromises();
        });
    };

    const itShouldShowTheBroadcastRoom = () => {
        it("should show the broadcast room", () => {
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: undefined,
            });
        });
    };

    beforeAll(() => {
        client = stubClient();
        mocked(requestMediaPermissions).mockResolvedValue({
            getTracks: (): Array<MediaStreamTrack> => [],
        } as unknown as MediaStream);
        jest.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
            [MediaDeviceKindEnum.AudioInput]: [
                {
                    deviceId: "d1",
                    label: "Device 1",
                } as MediaDeviceInfo,
                {
                    deviceId: "d2",
                    label: "Device 2",
                } as MediaDeviceInfo,
            ],
            [MediaDeviceKindEnum.AudioOutput]: [],
            [MediaDeviceKindEnum.VideoInput]: [],
        });
        jest.spyOn(MediaDeviceHandler.instance, "setDevice").mockImplementation();
    });

    describe("when rendering a started recording", () => {
        beforeEach(async () => {
            await renderPip(VoiceBroadcastInfoState.Started);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and selecting another input device", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("Change input device"));
                await userEvent.click(screen.getByText("Device 1"));
            });

            it("should select the device and pause and resume the broadcast", () => {
                expect(MediaDeviceHandler.instance.setDevice).toHaveBeenCalledWith(
                    "d1",
                    MediaDeviceKindEnum.AudioInput,
                );
                expect(recording.pause).toHaveBeenCalled();
                expect(recording.resume).toHaveBeenCalled();
            });
        });

        describe("and clicking the room name", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText("My room"));
            });

            itShouldShowTheBroadcastRoom();
        });

        describe("and clicking the room avatar", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText("room avatar: My room"));
            });

            itShouldShowTheBroadcastRoom();
        });

        describe("and clicking the pause button", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("pause voice broadcast"));
            });

            it("should pause the recording", () => {
                expect(recording.getState()).toBe(VoiceBroadcastInfoState.Paused);
            });
        });

        describe("and clicking the stop button", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("Stop Recording"));
                // modal rendering has some weird sleeps
                await sleep(100);
            });

            it("should display the confirm end dialog", () => {
                screen.getByText("Stop live broadcasting?");
            });

            describe("and confirming the dialog", () => {
                beforeEach(async () => {
                    await userEvent.click(screen.getByText("Yes, stop broadcast"));
                });

                it("should end the recording", () => {
                    expect(recording.getState()).toBe(VoiceBroadcastInfoState.Stopped);
                });
            });
        });

        describe("and there is no connection and clicking the pause button", () => {
            beforeEach(async () => {
                mocked(client.sendStateEvent).mockImplementation(() => {
                    throw new Error();
                });
                await userEvent.click(screen.getByLabelText("pause voice broadcast"));
            });

            it("should show a connection error info", () => {
                expect(screen.getByText("Connection error - Recording paused")).toBeInTheDocument();
            });

            describe("and the connection is back", () => {
                beforeEach(() => {
                    mocked(client.sendStateEvent).mockResolvedValue({ event_id: "e1" });
                    client.emit(ClientEvent.Sync, SyncState.Catchup, SyncState.Error);
                });

                it("should render a paused recording", async () => {
                    await expect(screen.findByLabelText("resume voice broadcast")).resolves.toBeInTheDocument();
                });
            });
        });
    });

    describe("when rendering a paused recording", () => {
        beforeEach(async () => {
            await renderPip(VoiceBroadcastInfoState.Paused);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicking the resume button", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("resume voice broadcast"));
            });

            it("should resume the recording", () => {
                expect(recording.getState()).toBe(VoiceBroadcastInfoState.Resumed);
            });
        });
    });
});
