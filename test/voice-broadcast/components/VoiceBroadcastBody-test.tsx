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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import {
    VoiceBroadcastBody,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingBody,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
} from "../../../src/voice-broadcast";
import { mkEvent, mkStubRoom, stubClient } from "../../test-utils";
import { IBodyProps } from "../../../src/components/views/messages/IBodyProps";

jest.mock("../../../src/voice-broadcast/components/molecules/VoiceBroadcastRecordingBody", () => ({
    VoiceBroadcastRecordingBody: jest.fn(),
}));

describe("VoiceBroadcastBody", () => {
    const roomId = "!room:example.com";
    const recordingTestid = "voice-recording";
    let client: MatrixClient;
    let room: Room;
    let infoEvent: MatrixEvent;
    let recording: VoiceBroadcastRecording;
    let onRecordingStateChanged: (state: VoiceBroadcastInfoState) => void;

    const mkVoiceBroadcastInfoEvent = (state: VoiceBroadcastInfoState) => {
        return mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            user: client.getUserId(),
            room: roomId,
            content: {
                state,
            },
        });
    };

    const renderVoiceBroadcast = () => {
        const props: IBodyProps = {
            mxEvent: infoEvent,
        } as unknown as IBodyProps;
        render(<VoiceBroadcastBody {...props} />);
        recording = VoiceBroadcastRecordingsStore.instance().getByInfoEvent(infoEvent, client);
        recording.on(VoiceBroadcastRecordingEvent.StateChanged, onRecordingStateChanged);
    };

    const itShouldRenderALiveVoiceBroadcast = () => {
        it("should render a live voice broadcast", () => {
            expect(VoiceBroadcastRecordingBody).toHaveBeenCalledWith(
                {
                    onClick: expect.any(Function),
                    live: true,
                    member: infoEvent.sender,
                    userId: client.getUserId(),
                    title: "@userId:matrix.org • test room",
                },
                {},
            );
            screen.getByTestId(recordingTestid);
            screen.getByText("Live");
        });
    };

    const itShouldRenderANonLiveVoiceBroadcast = () => {
        it("should render a non-live voice broadcast", () => {
            expect(VoiceBroadcastRecordingBody).toHaveBeenCalledWith(
                {
                    onClick: expect.any(Function),
                    live: false,
                    member: infoEvent.sender,
                    userId: client.getUserId(),
                    title: "@userId:matrix.org • test room",
                },
                {},
            );
            expect(screen.getByTestId(recordingTestid)).not.toBeNull();
            screen.getByTestId(recordingTestid);
            expect(screen.queryByText("live")).toBeNull();
        });
    };

    beforeEach(() => {
        mocked(VoiceBroadcastRecordingBody).mockImplementation(
            ({
                live,
                member: _member,
                onClick,
                title,
                userId: _userId,
            }) => {
                return (
                    <div
                        data-testid={recordingTestid}
                        onClick={onClick}
                    >
                        <div>{ title }</div>
                        <div>{ live && "Live" }</div>
                    </div>
                );
            },
        );
        client = stubClient();
        room = mkStubRoom(roomId, "test room", client);
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) {
                return room;
            }
        });
        infoEvent = mkVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Started);
        onRecordingStateChanged = jest.fn();
    });

    afterEach(() => {
        if (recording && onRecordingStateChanged) {
            recording.off(VoiceBroadcastRecordingEvent.StateChanged, onRecordingStateChanged);
        }
    });

    describe("when there is a Started Voice Broadcast info event", () => {
        beforeEach(() => {
            renderVoiceBroadcast();
        });

        itShouldRenderALiveVoiceBroadcast();

        describe("and it is clicked", () => {
            beforeEach(async () => {
                mocked(VoiceBroadcastRecordingBody).mockClear();
                mocked(onRecordingStateChanged).mockClear();
                await userEvent.click(screen.getByTestId(recordingTestid));
            });

            itShouldRenderANonLiveVoiceBroadcast();

            it("should call stop on the recording", () => {
                expect(recording.state).toBe(VoiceBroadcastInfoState.Stopped);
                expect(onRecordingStateChanged).toHaveBeenCalledWith(VoiceBroadcastInfoState.Stopped);
            });
        });
    });
});
