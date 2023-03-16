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
import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VoiceBroadcastPlaybackControl, VoiceBroadcastPlaybackState } from "../../../../src/voice-broadcast";

describe("<VoiceBroadcastPlaybackControl />", () => {
    const renderControl = (state: VoiceBroadcastPlaybackState): { result: RenderResult; onClick: () => void } => {
        const onClick = jest.fn();
        return {
            onClick,
            result: render(<VoiceBroadcastPlaybackControl state={state} onClick={onClick} />),
        };
    };

    it.each([
        VoiceBroadcastPlaybackState.Stopped,
        VoiceBroadcastPlaybackState.Paused,
        VoiceBroadcastPlaybackState.Buffering,
        VoiceBroadcastPlaybackState.Playing,
    ])("should render state %s as expected", (state: VoiceBroadcastPlaybackState) => {
        expect(renderControl(state).result.container).toMatchSnapshot();
    });

    it("should not render for error state", () => {
        expect(renderControl(VoiceBroadcastPlaybackState.Error).result.asFragment()).toMatchInlineSnapshot(
            `<DocumentFragment />`,
        );
    });

    describe("when clicking the control", () => {
        let onClick: () => void;

        beforeEach(async () => {
            onClick = renderControl(VoiceBroadcastPlaybackState.Playing).onClick;
            await userEvent.click(screen.getByLabelText("pause voice broadcast"));
        });

        it("should invoke the onClick callback", () => {
            expect(onClick).toHaveBeenCalled();
        });
    });
});
