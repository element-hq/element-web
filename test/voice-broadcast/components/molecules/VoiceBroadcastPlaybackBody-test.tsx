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
import { act, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastLiveness,
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
            VoiceBroadcastInfoState.Stopped,
            userId,
            client.getDeviceId(),
        );
    });

    beforeEach(() => {
        playback = new VoiceBroadcastPlayback(infoEvent, client);
        jest.spyOn(playback, "toggle").mockImplementation(() => Promise.resolve());
        jest.spyOn(playback, "getLiveness");
        jest.spyOn(playback, "getState");
        jest.spyOn(playback, "skipTo");
        jest.spyOn(playback, "durationSeconds", "get").mockReturnValue(23 * 60 + 42); // 23:42
    });

    describe("when rendering a buffering voice broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Buffering);
            mocked(playback.getLiveness).mockReturnValue("live");
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering a playing broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Playing);
            mocked(playback.getLiveness).mockReturnValue("not-live");
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and being in the middle of the playback", () => {
            beforeEach(() => {
                act(() => {
                    playback.emit(VoiceBroadcastPlaybackEvent.PositionChanged, 10 * 60 * 1000); // 10:00
                });
            });

            describe("and clicking 30s backward", () => {
                beforeEach(async () => {
                    await act(async () => {
                        await userEvent.click(screen.getByLabelText("30s backward"));
                    });
                });

                it("should seek 30s backward", () => {
                    expect(playback.skipTo).toHaveBeenCalledWith(9 * 60 + 30);
                });
            });

            describe("and clicking 30s forward", () => {
                beforeEach(async () => {
                    await act(async () => {
                        await userEvent.click(screen.getByLabelText("30s forward"));
                    });
                });

                it("should seek 30s forward", () => {
                    expect(playback.skipTo).toHaveBeenCalledWith(10 * 60 + 30);
                });
            });
        });
    });

    describe(`when rendering a stopped broadcast`, () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Stopped);
            mocked(playback.getLiveness).mockReturnValue("not-live");
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
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

            it("should render the new length", async () => {
                expect(await screen.findByText("00:42")).toBeInTheDocument();
            });
        });
    });

    describe.each([
        [VoiceBroadcastPlaybackState.Paused, "not-live"],
        [VoiceBroadcastPlaybackState.Playing, "live"],
    ])("when rendering a %s/%s broadcast", (state: VoiceBroadcastPlaybackState, liveness: VoiceBroadcastLiveness) => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(state);
            mocked(playback.getLiveness).mockReturnValue(liveness);
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });
});
