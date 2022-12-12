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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllActionStates, FormattingFunctions } from "@matrix-org/matrix-wysiwyg";

import { FormattingButtons } from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/FormattingButtons";

describe("FormattingButtons", () => {
    const wysiwyg = {
        bold: jest.fn(),
        italic: jest.fn(),
        underline: jest.fn(),
        strikeThrough: jest.fn(),
        inlineCode: jest.fn(),
    } as unknown as FormattingFunctions;

    const actionStates = {
        bold: "reversed",
        italic: "reversed",
        underline: "enabled",
        strikeThrough: "enabled",
        inlineCode: "enabled",
    } as AllActionStates;

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Should have the correspond CSS classes", () => {
        // When
        render(<FormattingButtons composer={wysiwyg} actionStates={actionStates} />);

        // Then
        expect(screen.getByLabelText("Bold")).toHaveClass("mx_FormattingButtons_active");
        expect(screen.getByLabelText("Italic")).toHaveClass("mx_FormattingButtons_active");
        expect(screen.getByLabelText("Underline")).not.toHaveClass("mx_FormattingButtons_active");
        expect(screen.getByLabelText("Strikethrough")).not.toHaveClass("mx_FormattingButtons_active");
        expect(screen.getByLabelText("Code")).not.toHaveClass("mx_FormattingButtons_active");
    });

    it("Should call wysiwyg function on button click", () => {
        // When
        render(<FormattingButtons composer={wysiwyg} actionStates={actionStates} />);
        screen.getByLabelText("Bold").click();
        screen.getByLabelText("Italic").click();
        screen.getByLabelText("Underline").click();
        screen.getByLabelText("Strikethrough").click();
        screen.getByLabelText("Code").click();

        // Then
        expect(wysiwyg.bold).toHaveBeenCalledTimes(1);
        expect(wysiwyg.italic).toHaveBeenCalledTimes(1);
        expect(wysiwyg.underline).toHaveBeenCalledTimes(1);
        expect(wysiwyg.strikeThrough).toHaveBeenCalledTimes(1);
        expect(wysiwyg.inlineCode).toHaveBeenCalledTimes(1);
    });

    it("Should display the tooltip on mouse over", async () => {
        // When
        const user = userEvent.setup();
        render(<FormattingButtons composer={wysiwyg} actionStates={actionStates} />);
        await user.hover(screen.getByLabelText("Bold"));

        // Then
        expect(await screen.findByText("Bold")).toBeTruthy();
    });

    it("Should not have hover style when active", async () => {
        // When
        const user = userEvent.setup();
        render(<FormattingButtons composer={wysiwyg} actionStates={actionStates} />);
        await user.hover(screen.getByLabelText("Bold"));

        // Then
        expect(screen.getByLabelText("Bold")).not.toHaveClass("mx_FormattingButtons_Button_hover");

        // When
        await user.hover(screen.getByLabelText("Underline"));

        // Then
        expect(screen.getByLabelText("Underline")).toHaveClass("mx_FormattingButtons_Button_hover");
    });
});
