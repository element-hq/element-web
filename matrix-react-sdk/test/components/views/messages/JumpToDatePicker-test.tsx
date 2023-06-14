/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { render } from "@testing-library/react";

import JumpToDatePicker from "../../../../src/components/views/messages/JumpToDatePicker";

describe("JumpToDatePicker", () => {
    const nowDate = new Date("2021-12-17T08:09:00.000Z");
    beforeEach(() => {
        // Set a stable fake time here so the test is always consistent
        jest.useFakeTimers();
        jest.setSystemTime(nowDate.getTime());
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("renders the date picker correctly", () => {
        const { asFragment } = render(
            <JumpToDatePicker ts={new Date("2020-07-04T05:55:00.000Z").getTime()} onDatePicked={() => {}} />,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
