/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/dom";

import * as stories from "./AudioPlayerView.stories.tsx";
import { AudioPlayerView, type AudioPlayerViewActions, type AudioPlayerViewSnapshot } from "./AudioPlayerView";
import { MockViewModel } from "../../MockViewModel";

const { Default, NoMediaName, NoSize, HasError } = composeStories(stories);

describe("AudioPlayerView", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders the audio player in default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the audio player without media name", () => {
        const { container } = render(<NoMediaName />);
        expect(container).toMatchSnapshot();
    });

    it("renders the audio player without size", () => {
        const { container } = render(<NoSize />);
        expect(container).toMatchSnapshot();
    });

    it("renders the audio player in error state", () => {
        const { container } = render(<HasError />);
        expect(container).toMatchSnapshot();
    });

    const onKeyDown = jest.fn();
    const togglePlay = jest.fn();
    const onSeekbarChange = jest.fn();

    class AudioPlayerViewModel extends MockViewModel<AudioPlayerViewSnapshot> implements AudioPlayerViewActions {
        public onKeyDown = onKeyDown;
        public togglePlay = togglePlay;
        public onSeekbarChange = onSeekbarChange;
    }

    it("should attach vm methods", async () => {
        const user = userEvent.setup();
        const vm = new AudioPlayerViewModel({
            playbackState: "stopped",
            mediaName: "Test Audio",
            durationSeconds: 300,
            playedSeconds: 120,
            percentComplete: 30,
            sizeBytes: 3500,
            error: false,
        });

        render(<AudioPlayerView vm={vm} />);
        await user.click(screen.getByRole("button", { name: "Play" }));
        expect(togglePlay).toHaveBeenCalled();

        // user event doesn't support change events on sliders, so we use fireEvent
        fireEvent.change(screen.getByRole("slider", { name: "Audio seek bar" }), { target: { value: "50" } });
        expect(onSeekbarChange).toHaveBeenCalled();

        await user.type(screen.getByLabelText("Audio player"), "{arrowup}");
        expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowUp" }));
    });
});
