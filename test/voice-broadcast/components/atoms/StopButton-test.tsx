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
import { render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StopButton } from "../../../../src/voice-broadcast";

describe("StopButton", () => {
    let result: RenderResult;
    let onClick: () => {};

    beforeEach(() => {
        onClick = jest.fn();
        result = render(<StopButton onClick={onClick} />);
    });

    it("should render as expected", () => {
        expect(result.container).toMatchSnapshot();
    });

    describe("when clicking it", () => {
        beforeEach(async () => {
            await userEvent.click(result.getByLabelText("stop voice broadcast"));
        });

        it("should invoke the callback", () => {
            expect(onClick).toHaveBeenCalled();
        });
    });
});
