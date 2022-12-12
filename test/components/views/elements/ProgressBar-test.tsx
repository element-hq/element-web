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
import { act, render } from "@testing-library/react";

import ProgressBar from "../../../../src/components/views/elements/ProgressBar";

jest.useFakeTimers();

describe("<ProgressBar/>", () => {
    it("works when animated", () => {
        const { container, rerender } = render(<ProgressBar max={100} value={50} animated={true} />);
        const progress = container.querySelector<HTMLProgressElement>("progress")!;

        // The animation always starts from 0
        expect(progress.value).toBe(0);

        // Await the animation to conclude to our initial value of 50
        act(() => {
            jest.runAllTimers();
        });
        expect(progress.position).toBe(0.5);

        // Move the needle to 80%
        rerender(<ProgressBar max={100} value={80} animated={true} />);
        expect(progress.position).toBe(0.5);

        // Let the animaiton run a tiny bit, assert it has moved from where it was to where it needs to go
        act(() => {
            jest.advanceTimersByTime(150);
        });
        expect(progress.position).toBeGreaterThan(0.5);
        expect(progress.position).toBeLessThan(0.8);
    });

    it("works when not animated", () => {
        const { container, rerender } = render(<ProgressBar max={100} value={50} animated={false} />);
        const progress = container.querySelector<HTMLProgressElement>("progress")!;

        // Without animation all positional updates are immediate, not requiring timers to run
        expect(progress.position).toBe(0.5);
        rerender(<ProgressBar max={100} value={80} animated={false} />);
        expect(progress.position).toBe(0.8);
    });
});
