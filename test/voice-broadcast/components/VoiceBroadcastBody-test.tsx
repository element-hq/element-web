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

import React, { ReactElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastBody as UnwrappedVoiceBroadcastBody,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingBody,
    VoiceBroadcastRecording,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastPlayback,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { stubClient, wrapInSdkContext } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";
import { MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import { SdkContextClass } from "../../../src/contexts/SDKContext";

jest.mock("../../../src/voice-broadcast/components/molecules/VoiceBroadcastRecordingBody", () => ({
    VoiceBroadcastRecordingBody: jest.fn(),
}));

jest.mock("../../../src/voice-broadcast/components/molecules/VoiceBroadcastPlaybackBody", () => ({
    VoiceBroadcastPlaybackBody: jest.fn(),
}));

jest.mock("../../../src/utils/permalinks/Permalinks");
jest.mock("../../../src/utils/MediaEventHelper");

describe("VoiceBroadcastBody", () => {
    const roomId = "!room:example.com";
    let userId: string;
    let deviceId: string;
    let client: MatrixClient;
    let room: Room;
    let infoEvent: MatrixEvent;
    let stoppedEvent: MatrixEvent;
    let testRecording: VoiceBroadcastRecording;
    let testPlayback: VoiceBroadcastPlayback;

    const renderVoiceBroadcast = () => {
        const VoiceBroadcastBody = wrapInSdkContext(UnwrappedVoiceBroadcastBody, SdkContextClass.instance);
        render(
            <VoiceBroadcastBody
                mxEvent={infoEvent}
                mediaEventHelper={new MediaEventHelper(infoEvent)}
                onHeightChanged={() => {}}
                onMessageAllowed={() => {}}
                permalinkCreator={new RoomPermalinkCreator(room)}
            />,
        );
        testRecording = SdkContextClass.instance.voiceBroadcastRecordingsStore.getByInfoEvent(infoEvent, client);
    };

    beforeEach(() => {
        client = stubClient();
        userId = client.getUserId() || "";
        deviceId = client.getDeviceId() || "";
        mocked(client.relations).mockClear();
        mocked(client.relations).mockResolvedValue({ events: [] });
        room = new Room(roomId, client, userId);
        mocked(client.getRoom).mockImplementation((getRoomId?: string) => {
            if (getRoomId === roomId) return room;
            return null;
        });

        infoEvent = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Started, userId, deviceId);
        stoppedEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            userId,
            deviceId,
            infoEvent,
        );
        room.addEventsToTimeline([infoEvent], true, room.getLiveTimeline());
        testRecording = new VoiceBroadcastRecording(infoEvent, client);
        testPlayback = new VoiceBroadcastPlayback(infoEvent, client, new VoiceBroadcastRecordingsStore());
        mocked(VoiceBroadcastRecordingBody).mockImplementation(({ recording }): ReactElement | null => {
            if (testRecording === recording) {
                return <div data-testid="voice-broadcast-recording-body" />;
            }

            return null;
        });

        mocked(VoiceBroadcastPlaybackBody).mockImplementation(({ playback }): ReactElement | null => {
            if (testPlayback === playback) {
                return <div data-testid="voice-broadcast-playback-body" />;
            }

            return null;
        });

        jest.spyOn(SdkContextClass.instance.voiceBroadcastRecordingsStore, "getByInfoEvent").mockImplementation(
            (getEvent: MatrixEvent, getClient: MatrixClient): VoiceBroadcastRecording => {
                if (getEvent === infoEvent && getClient === client) {
                    return testRecording;
                }

                throw new Error("unexpected event");
            },
        );

        jest.spyOn(SdkContextClass.instance.voiceBroadcastPlaybacksStore, "getByInfoEvent").mockImplementation(
            (getEvent: MatrixEvent): VoiceBroadcastPlayback => {
                if (getEvent === infoEvent) {
                    return testPlayback;
                }

                throw new Error("unexpected event");
            },
        );
    });

    describe("when there is a stopped voice broadcast", () => {
        beforeEach(() => {
            room.addEventsToTimeline([stoppedEvent], true, room.getLiveTimeline());
            renderVoiceBroadcast();
        });

        it("should render a voice broadcast playback body", () => {
            screen.getByTestId("voice-broadcast-playback-body");
        });
    });

    describe("when there is a started voice broadcast from the current user", () => {
        beforeEach(() => {
            renderVoiceBroadcast();
        });

        it("should render a voice broadcast recording body", () => {
            screen.getByTestId("voice-broadcast-recording-body");
        });

        describe("and the recordings ends", () => {
            beforeEach(() => {
                act(() => {
                    room.addEventsToTimeline([stoppedEvent], true, room.getLiveTimeline());
                });
            });

            it("should render a voice broadcast playback body", () => {
                screen.getByTestId("voice-broadcast-playback-body");
            });
        });
    });

    describe("when displaying a voice broadcast playback", () => {
        beforeEach(() => {
            mocked(client).getUserId.mockReturnValue("@other:example.com");
            renderVoiceBroadcast();
        });

        it("should render a voice broadcast playback body", () => {
            screen.getByTestId("voice-broadcast-playback-body");
        });
    });
});
