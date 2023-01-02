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
    VoiceBroadcastInfoState,
    VoiceBroadcastLiveness,
    VoiceBroadcastPlayback,
    VoiceBroadcastSmallPlaybackBody,
    VoiceBroadcastPlaybackState,
} from "../../../../src/voice-broadcast";
import { stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../utils/test-utils";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: {room.name}</div>;
    }),
}));

describe("<VoiceBroadcastSmallPlaybackBody />", () => {
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
            VoiceBroadcastInfoState.Stopped,
            userId,
            client.getDeviceId()!,
        );
    });

    beforeEach(() => {
        playback = new VoiceBroadcastPlayback(
            infoEvent,
            client,
            SdkContextClass.instance.voiceBroadcastRecordingsStore,
        );
        jest.spyOn(playback, "toggle").mockImplementation(() => Promise.resolve());
        jest.spyOn(playback, "getLiveness");
        jest.spyOn(playback, "getState");
    });

    describe("when rendering a buffering broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Buffering);
            mocked(playback.getLiveness).mockReturnValue("live");
            renderResult = render(<VoiceBroadcastSmallPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering a playing broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Playing);
            mocked(playback.getLiveness).mockReturnValue("not-live");
            renderResult = render(<VoiceBroadcastSmallPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe(`when rendering a stopped broadcast`, () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Stopped);
            mocked(playback.getLiveness).mockReturnValue("not-live");
            renderResult = render(<VoiceBroadcastSmallPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicking the play button", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByLabelText("play voice broadcast"));
            });

            it("should toggle the playback", () => {
                expect(playback.toggle).toHaveBeenCalled();
            });
        });
    });

    describe.each([
        { state: VoiceBroadcastPlaybackState.Paused, liveness: "not-live" },
        { state: VoiceBroadcastPlaybackState.Playing, liveness: "live" },
    ] as Array<{ state: VoiceBroadcastPlaybackState; liveness: VoiceBroadcastLiveness }>)(
        "when rendering a %s/%s broadcast",
        ({ state, liveness }) => {
            beforeEach(() => {
                mocked(playback.getState).mockReturnValue(state);
                mocked(playback.getLiveness).mockReturnValue(liveness);
                renderResult = render(<VoiceBroadcastSmallPlaybackBody playback={playback} />);
            });

            it("should render as expected", () => {
                expect(renderResult.container).toMatchSnapshot();
            });
        },
    );
});
