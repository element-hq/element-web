/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DialPad, { BUTTONS, BUTTON_LETTERS } from "../../../../src/components/views/voip/DialPad";

it("when hasDial is true, displays all expected numbers and letters", () => {
    render(<DialPad onDigitPress={jest.fn()} hasDial={true} onDialPress={jest.fn()} />);

    // check that we have the expected number of buttons + 1 for the dial button
    expect(screen.getAllByRole("button")).toHaveLength(BUTTONS.length + 1);

    // BUTTONS represents the numbers and symbols
    BUTTONS.forEach((button) => {
        expect(screen.getByText(button)).toBeInTheDocument();
    });

    // BUTTON_LETTERS represents the `ABC` type strings you see on the keypad, but also contains
    // some empty strings, so we filter them out prior to tests
    BUTTON_LETTERS.filter(Boolean).forEach((letterSet) => {
        expect(screen.getByText(letterSet)).toBeInTheDocument();
    });

    // check for the dial button
    expect(screen.getByRole("button", { name: "Dial" })).toBeInTheDocument();
});

it("clicking a digit button calls the correct function", async () => {
    const mockOnDigitPress = jest.fn();
    render(<DialPad onDigitPress={mockOnDigitPress} hasDial={true} onDialPress={jest.fn()} />);

    // click the `1` button
    const buttonText = "1";
    await userEvent.click(screen.getByText(buttonText, { exact: false }));
    expect(mockOnDigitPress).toHaveBeenCalledTimes(1);
    expect(mockOnDigitPress.mock.calls[0][0]).toBe(buttonText);
});

it("clicking the dial button calls the correct function", async () => {
    const mockOnDial = jest.fn();
    render(<DialPad onDigitPress={jest.fn()} hasDial={true} onDialPress={mockOnDial} />);

    // click the `1` button
    const buttonText = "Dial";
    await userEvent.click(screen.getByRole("button", { name: buttonText }));
    expect(mockOnDial).toHaveBeenCalledTimes(1);
    expect(mockOnDial).toHaveBeenCalledWith(); // represents no arguments in the call
});
