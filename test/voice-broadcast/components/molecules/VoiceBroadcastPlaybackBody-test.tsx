/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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
import { filterConsole, stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../utils/test-utils";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";

jest.mock("../../../../src/dispatcher/dispatcher");

// mock RoomAvatar, because it is doing too much fancy stuff
jest.mock("../../../../src/components/views/avatars/RoomAvatar", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ room }) => {
        return <div data-testid="room-avatar">room avatar: {room.name}</div>;
    }),
}));

describe("VoiceBroadcastPlaybackBody", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    const duration = 23 * 60 + 42; // 23:42
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let renderResult: RenderResult;

    filterConsole(
        // expected for some tests
        "voice broadcast chunk event to skip to not found",
    );

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
        playback = new VoiceBroadcastPlayback(
            infoEvent,
            client,
            SdkContextClass.instance.voiceBroadcastRecordingsStore,
        );
        jest.spyOn(playback, "toggle").mockImplementation(() => Promise.resolve());
        jest.spyOn(playback, "getLiveness");
        jest.spyOn(playback, "getState");
        jest.spyOn(playback, "skipTo");
        jest.spyOn(playback, "durationSeconds", "get").mockReturnValue(duration);
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
                    playback.emit(VoiceBroadcastPlaybackEvent.TimesChanged, {
                        duration,
                        position: 10 * 60,
                        timeLeft: duration - 10 * 60,
                    });
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

        describe("and clicking the room name", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText("My room"));
            });

            it("should not view the room", () => {
                expect(dis.dispatch).not.toHaveBeenCalled();
            });
        });
    });

    describe("when rendering a playing broadcast in pip mode", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Playing);
            mocked(playback.getLiveness).mockReturnValue("not-live");
            renderResult = render(<VoiceBroadcastPlaybackBody pip={true} playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicking the room name", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText("My room"));
            });

            it("should view the room", () => {
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    room_id: roomId,
                    metricsTrigger: undefined,
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

        describe("and the times update", () => {
            beforeEach(() => {
                act(() => {
                    playback.emit(VoiceBroadcastPlaybackEvent.TimesChanged, {
                        duration,
                        position: 5 * 60 + 13,
                        timeLeft: 7 * 60 + 5,
                    });
                });
            });

            it("should render the times", async () => {
                expect(await screen.findByText("05:13")).toBeInTheDocument();
                expect(await screen.findByText("-07:05")).toBeInTheDocument();
            });
        });
    });

    describe("when rendering an error broadcast", () => {
        beforeEach(() => {
            mocked(playback.getState).mockReturnValue(VoiceBroadcastPlaybackState.Error);
            renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe.each([
        [VoiceBroadcastPlaybackState.Paused, "not-live"],
        [VoiceBroadcastPlaybackState.Playing, "live"],
    ] satisfies [VoiceBroadcastPlaybackState, VoiceBroadcastLiveness][])(
        "when rendering a %s/%s broadcast",
        (state: VoiceBroadcastPlaybackState, liveness: VoiceBroadcastLiveness) => {
            beforeEach(() => {
                mocked(playback.getState).mockReturnValue(state);
                mocked(playback.getLiveness).mockReturnValue(liveness);
                renderResult = render(<VoiceBroadcastPlaybackBody playback={playback} />);
            });

            it("should render as expected", () => {
                expect(renderResult.container).toMatchSnapshot();
            });
        },
    );

    it("when there is a broadcast without sender, it should raise an error", () => {
        infoEvent.sender = null;
        expect(() => {
            render(<VoiceBroadcastPlaybackBody playback={playback} />);
        }).toThrow(`Voice Broadcast sender not found (event ${playback.infoEvent.getId()})`);
    });
});
