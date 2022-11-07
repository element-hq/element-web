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
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { act, render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
} from "../../../../src/voice-broadcast";
import { stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../utils/test-utils";

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: { room.name }</div>;
    }),
}));

describe("VoiceBroadcastPlaybackBody", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let renderResult: RenderResult;

    beforeAll(() => {
        client = stubClient();
        mocked(client.relations).mockClear();
        mocked(client.relations).mockResolvedValue({ events: [] });

        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            userId,
            client.getDeviceId(),
        );
    });

    beforeEach(() => {
        playback = new VoiceBroadcastPlayback(infoEvent, client);
        jest.spyOn(playback, "toggle").mockImplementation(() => Promise.resolve());
        jest.spyOn(playback, "getState");
        jest.spyOn(playback, "durationSeconds", "get").mockReturnValue(23 * 60 + 42); // 23:42
    });

    describe("when rendering a buffering voice broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Buffering);
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe(`when rendering a stopped broadcast`, () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Stopped);
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        describe("and clicking the play button", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByLabelText("play voice broadcast"));
            });

            it("should toggle the recording", () => {
                expect(playback.toggle).toHaveBeenCalled();
            });
        });

        describe("and the length updated", () => {
            beforeEach(() => {
                act(() => {
                    playback.emit(VoiceBroadcastPlaybackEvent.LengthChanged, 42000); // 00:42
                });
            });

            it("should render as expected", () => {
                expect(renderResult.container).toMatchSnapshot();
            });
        });
    });

    describe.each([
        VoiceBroadcastPlaybackState.Paused,
        VoiceBroadcastPlaybackState.Playing,
    ])("when rendering a %s broadcast", (playbackState: VoiceBroadcastPlaybackState) => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(playbackState);
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });
});
