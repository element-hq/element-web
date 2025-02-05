/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type RefObject } from "react";
import { mocked } from "jest-mock";
import { act, fireEvent, render, type RenderResult } from "jest-matrix-react";

import { type Playback } from "../../../../../src/audio/Playback";
import { createTestPlayback } from "../../../../test-utils/audio";
import SeekBar from "../../../../../src/components/views/audio_messages/SeekBar";

describe("SeekBar", () => {
    let playback: Playback;
    let renderResult: RenderResult;
    let frameRequestCallback: FrameRequestCallback;
    let seekBarRef: RefObject<SeekBar>;

    beforeEach(() => {
        seekBarRef = createRef();
        jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
            frameRequestCallback = callback;
            return 0;
        });
    });

    afterEach(() => {
        mocked(window.requestAnimationFrame).mockRestore();
    });

    describe("when rendering a SeekBar for an empty playback", () => {
        beforeEach(() => {
            playback = createTestPlayback({
                durationSeconds: 0,
                timeSeconds: 0,
            });
            renderResult = render(<SeekBar ref={seekBarRef} playback={playback} />);
        });

        it("should render correctly", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering a SeekBar", () => {
        beforeEach(() => {
            playback = createTestPlayback();
            renderResult = render(<SeekBar ref={seekBarRef} playback={playback} />);
        });

        it("should render the initial position", () => {
            // expected value 3141 / 31415 ~ 0.099984084
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and the playback proceeds", () => {
            beforeEach(async () => {
                // @ts-ignore
                playback.timeSeconds = 6969;
                act(() => {
                    playback.liveData.update([playback.timeSeconds, playback.durationSeconds]);
                    frameRequestCallback(0);
                });
            });

            it("should render as expected", () => {
                // expected value 6969 / 31415 ~ 0.221836702
                expect(renderResult.container).toMatchSnapshot();
            });
        });

        describe("and seeking position with the slider", () => {
            beforeEach(() => {
                const rangeInput = renderResult.container.querySelector("[type='range']");
                act(() => {
                    fireEvent.change(rangeInput!, { target: { value: 0.5 } });
                });
            });

            it("should update the playback", () => {
                expect(playback.skipTo).toHaveBeenCalledWith(0.5 * playback.durationSeconds);
            });

            describe("and seeking left", () => {
                beforeEach(() => {
                    mocked(playback.skipTo).mockClear();
                    act(() => {
                        seekBarRef.current!.left();
                    });
                });

                it("should skip to minus 5 seconds", () => {
                    expect(playback.skipTo).toHaveBeenCalledWith(playback.timeSeconds - 5);
                });
            });

            describe("and seeking right", () => {
                beforeEach(() => {
                    mocked(playback.skipTo).mockClear();
                    act(() => {
                        seekBarRef.current!.right();
                    });
                });

                it("should skip to plus 5 seconds", () => {
                    expect(playback.skipTo).toHaveBeenCalledWith(playback.timeSeconds + 5);
                });
            });
        });
    });

    describe("when rendering a disabled SeekBar", () => {
        beforeEach(async () => {
            renderResult = render(<SeekBar disabled={true} playback={playback} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });
});
