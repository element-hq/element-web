/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
