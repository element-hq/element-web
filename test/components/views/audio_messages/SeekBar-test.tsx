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

import React, { createRef, RefObject } from "react";
import { mocked } from "jest-mock";
import { act, fireEvent, render, RenderResult } from "@testing-library/react";

import { Playback } from "../../../../src/audio/Playback";
import { createTestPlayback } from "../../../test-utils/audio";
import SeekBar from "../../../../src/components/views/audio_messages/SeekBar";

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
