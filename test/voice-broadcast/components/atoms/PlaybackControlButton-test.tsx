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

import { PlaybackControlButton, VoiceBroadcastPlaybackState } from "../../../../src/voice-broadcast";

describe("PlaybackControlButton", () => {
    let onClick: () => void;

    beforeEach(() => {
        onClick = jest.fn();
    });

    it.each([
        [VoiceBroadcastPlaybackState.Playing],
        [VoiceBroadcastPlaybackState.Paused],
        [VoiceBroadcastPlaybackState.Stopped],
    ])("should render state »%s« as expected", (state: VoiceBroadcastPlaybackState) => {
        const result = render(<PlaybackControlButton state={state} onClick={onClick} />);
        expect(result.container).toMatchSnapshot();
    });

    it("should call onClick on click", async () => {
        render(<PlaybackControlButton state={VoiceBroadcastPlaybackState.Playing} onClick={onClick} />);
        const button = screen.getByLabelText("pause voice broadcast");
        await userEvent.click(button);
        expect(onClick).toHaveBeenCalled();
    });
});
