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
import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VoiceBroadcastControl } from "../../../../src/voice-broadcast";
import { Icon as StopIcon } from "../../../../res/img/compound/stop-16.svg";

describe("VoiceBroadcastControl", () => {
    let result: RenderResult;
    let onClick: () => void;

    beforeEach(() => {
        onClick = jest.fn();
    });

    describe("when rendering it", () => {
        beforeEach(() => {
            const stopIcon = <StopIcon className="mx_Icon mx_Icon_16" />;
            result = render(<VoiceBroadcastControl onClick={onClick} label="test label" icon={stopIcon} />);
        });

        it("should render as expected", () => {
            expect(result.container).toMatchSnapshot();
        });

        describe("when clicking it", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("test label"));
            });

            it("should call onClick", () => {
                expect(onClick).toHaveBeenCalled();
            });
        });
    });
});
