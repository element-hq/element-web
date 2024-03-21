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

import React from "react";
import { mocked } from "jest-mock";
import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { act, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingPip,
    VoiceBroadcastRecordingsStore,
} from "../../../../src/voice-broadcast";
import { flushPromises, stubClient } from "../../../test-utils";
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

describe("VoiceBroadcastPreRecordingPip", () => {
    let renderResult: RenderResult;
    let preRecording: VoiceBroadcastPreRecording;
    let playbacksStore: VoiceBroadcastPlaybacksStore;
    let recordingsStore: VoiceBroadcastRecordingsStore;
    let client: MatrixClient;
    let room: Room;
    let sender: RoomMember;

    const itShouldShowTheBroadcastRoom = () => {
        it("should show the broadcast room", () => {
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: undefined,
            });
        });
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room@example.com", client, client.getUserId() || "");
        sender = new RoomMember(room.roomId, client.getUserId() || "");
        recordingsStore = new VoiceBroadcastRecordingsStore();
        playbacksStore = new VoiceBroadcastPlaybacksStore(recordingsStore);
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
        preRecording = new VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
        jest.spyOn(preRecording, "start").mockResolvedValue();
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe("when rendered", () => {
        beforeEach(async () => {
            renderResult = render(<VoiceBroadcastPreRecordingPip voiceBroadcastPreRecording={preRecording} />);

            await act(async () => {
                flushPromises();
            });
        });

        it("should match the snapshot", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and double clicking »Go live«", () => {
            beforeEach(async () => {
                await act(async () => {
                    await userEvent.click(screen.getByText("Go live"));
                    await userEvent.click(screen.getByText("Go live"));
                });
            });

            it("should call start once", () => {
                expect(preRecording.start).toHaveBeenCalledTimes(1);
            });
        });

        describe("and clicking the room name", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText(room.name));
            });

            itShouldShowTheBroadcastRoom();
        });

        describe("and clicking the room avatar", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText(`room avatar: ${room.name}`));
            });

            itShouldShowTheBroadcastRoom();
        });

        describe("and clicking the device label", () => {
            beforeEach(async () => {
                await act(async () => {
                    await userEvent.click(screen.getByText("Default Device"));
                });
            });

            it("should display the device selection", () => {
                expect(screen.queryAllByText("Default Device").length).toBe(2);
                expect(screen.queryByText("Device 1")).toBeInTheDocument();
                expect(screen.queryByText("Device 2")).toBeInTheDocument();
            });

            describe("and selecting a device", () => {
                beforeEach(async () => {
                    await act(async () => {
                        await userEvent.click(screen.getByText("Device 1"));
                    });
                });

                it("should set it as current device", () => {
                    expect(MediaDeviceHandler.instance.setDevice).toHaveBeenCalledWith(
                        "d1",
                        MediaDeviceKindEnum.AudioInput,
                    );
                });

                it("should not show the device selection", () => {
                    expect(screen.queryByText("Default Device")).not.toBeInTheDocument();
                    // expected to be one in the document, displayed in the pip directly
                    expect(screen.queryByText("Device 1")).toBeInTheDocument();
                    expect(screen.queryByText("Device 2")).not.toBeInTheDocument();
                });
            });
        });
    });
});
