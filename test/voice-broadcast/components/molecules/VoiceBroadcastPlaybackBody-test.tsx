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
import { render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import {
    VoiceBroadcastInfoEventType,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastPlaybackState,
} from "../../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../../test-utils";

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
        infoEvent = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            content: {},
            room: roomId,
            user: userId,
        });
    });

    beforeEach(() => {
        playback = new VoiceBroadcastPlayback(infoEvent, client);
        jest.spyOn(playback, "toggle");
        jest.spyOn(playback, "getState");
    });

    describe("when rendering a buffering voice broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Buffering);
        });

        beforeEach(() => {
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering a broadcast", () => {
        beforeEach(() => {
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicking the play button", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByLabelText("resume voice broadcast"));
            });

            it("should toggle the recording", () => {
                expect(playback.toggle).toHaveBeenCalled();
            });
        });
    });
});
