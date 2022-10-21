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
import { act, render, screen } from "@testing-library/react";
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastBody,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingBody,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybacksStore,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

jest.mock("../../../src/voice-broadcast/components/molecules/VoiceBroadcastRecordingBody", () => ({
    VoiceBroadcastRecordingBody: jest.fn(),
}));

jest.mock("../../../src/voice-broadcast/components/molecules/VoiceBroadcastPlaybackBody", () => ({
    VoiceBroadcastPlaybackBody: jest.fn(),
}));

describe("VoiceBroadcastBody", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let infoEvent: MatrixEvent;
    let stoppedEvent: MatrixEvent;
    let testRecording: VoiceBroadcastRecording;
    let testPlayback: VoiceBroadcastPlayback;

    const renderVoiceBroadcast = () => {
        render(<VoiceBroadcastBody
            mxEvent={infoEvent}
            mediaEventHelper={null}
            onHeightChanged={() => {}}
            onMessageAllowed={() => {}}
            permalinkCreator={null}
        />);
        testRecording = VoiceBroadcastRecordingsStore.instance().getByInfoEvent(infoEvent, client);
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId());
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) return room;
        });

        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId(),
            client.getDeviceId(),
        );
        stoppedEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            client.getUserId(),
            client.getDeviceId(),
            infoEvent,
        );
        room.addEventsToTimeline([infoEvent], true, room.getLiveTimeline());
        testRecording = new VoiceBroadcastRecording(infoEvent, client);
        testPlayback = new VoiceBroadcastPlayback(infoEvent, client);
        mocked(VoiceBroadcastRecordingBody).mockImplementation(({ recording }) => {
            if (testRecording === recording) {
                return <div data-testid="voice-broadcast-recording-body" />;
            }
        });

        mocked(VoiceBroadcastPlaybackBody).mockImplementation(({ playback }) => {
            if (testPlayback === playback) {
                return <div data-testid="voice-broadcast-playback-body" />;
            }
        });

        jest.spyOn(VoiceBroadcastRecordingsStore.instance(), "getByInfoEvent").mockImplementation(
            (getEvent: MatrixEvent, getClient: MatrixClient) => {
                if (getEvent === infoEvent && getClient === client) {
                    return testRecording;
                }
            },
        );

        jest.spyOn(VoiceBroadcastPlaybacksStore.instance(), "getByInfoEvent").mockImplementation(
            (getEvent: MatrixEvent) => {
                if (getEvent === infoEvent) {
                    return testPlayback;
                }
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
