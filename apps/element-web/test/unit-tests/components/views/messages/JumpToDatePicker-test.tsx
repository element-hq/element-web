/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import JumpToDatePicker from "../../../../../src/components/views/messages/JumpToDatePicker";

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
