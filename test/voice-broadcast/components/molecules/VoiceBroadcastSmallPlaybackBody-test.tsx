/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
