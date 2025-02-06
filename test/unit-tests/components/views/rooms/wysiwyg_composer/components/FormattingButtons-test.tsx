/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { cleanup, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import {
    type ActionState,
    type ActionTypes,
    type AllActionStates,
    type FormattingFunctions,
} from "@vector-im/matrix-wysiwyg";

import { FormattingButtons } from "../../../../../../../src/components/views/rooms/wysiwyg_composer/components/FormattingButtons";
import * as LinkModal from "../../../../../../../src/components/views/rooms/wysiwyg_composer/components/LinkModal";
import { setLanguage } from "../../../../../../../src/languageHandler";

const mockWysiwyg = {
    bold: jest.fn(),
    italic: jest.fn(),
    underline: jest.fn(),
    strikeThrough: jest.fn(),
    inlineCode: jest.fn(),
    codeBlock: jest.fn(),
    link: jest.fn(),
    orderedList: jest.fn(),
    unorderedList: jest.fn(),
    quote: jest.fn(),
    indent: jest.fn(),
    unIndent: jest.fn(),
} as unknown as FormattingFunctions;

const openLinkModalSpy = jest.spyOn(LinkModal, "openLinkModal");

const testCases: Record<
    Exclude<ActionTypes, "undo" | "redo" | "clear" | "indent" | "unindent">,
    { label: string; mockFormatFn: jest.Func | jest.SpyInstance }
> = {
    bold: { label: "Bold", mockFormatFn: mockWysiwyg.bold },
    italic: { label: "Italic", mockFormatFn: mockWysiwyg.italic },
    underline: { label: "Underline", mockFormatFn: mockWysiwyg.underline },
    strikeThrough: { label: "Strikethrough", mockFormatFn: mockWysiwyg.strikeThrough },
    inlineCode: { label: "Code", mockFormatFn: mockWysiwyg.inlineCode },
    codeBlock: { label: "Code block", mockFormatFn: mockWysiwyg.inlineCode },
    link: { label: "Link", mockFormatFn: openLinkModalSpy },
    orderedList: { label: "Numbered list", mockFormatFn: mockWysiwyg.orderedList },
    unorderedList: { label: "Bulleted list", mockFormatFn: mockWysiwyg.unorderedList },
    quote: { label: "Quote", mockFormatFn: mockWysiwyg.quote },
};

const createActionStates = (state: ActionState): AllActionStates => {
    return Object.fromEntries(Object.keys(testCases).map((testKey) => [testKey, state])) as AllActionStates;
};

const defaultActionStates = createActionStates("enabled");

const renderComponent = (props = {}) => {
    return render(<FormattingButtons composer={mockWysiwyg} actionStates={defaultActionStates} {...props} />);
};

const classes = {
    active: "mx_FormattingButtons_active",
    hover: "mx_FormattingButtons_Button_hover",
    disabled: "mx_FormattingButtons_disabled",
};

describe("FormattingButtons", () => {
    beforeEach(() => {
        openLinkModalSpy.mockReturnValue(undefined);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("renders in german", async () => {
        await setLanguage("de");
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();

        await setLanguage("en");
    });

    it("Each button should not have active class when enabled", () => {
        renderComponent();

        Object.values(testCases).forEach(({ label }) => {
            expect(screen.getByLabelText(label)).not.toHaveClass(classes.active);
        });
    });

    it("Each button should have active class when reversed", () => {
        const reversedActionStates = createActionStates("reversed");
        renderComponent({ actionStates: reversedActionStates });

        Object.values(testCases).forEach((testCase) => {
            const { label } = testCase;
            expect(screen.getByLabelText(label)).toHaveClass(classes.active);
        });
    });

    it("Each button should have disabled class when disabled", () => {
        const disabledActionStates = createActionStates("disabled");
        renderComponent({ actionStates: disabledActionStates });

        Object.values(testCases).forEach((testCase) => {
            const { label } = testCase;
            expect(screen.getByLabelText(label)).toHaveClass(classes.disabled);
        });
    });

    it("Should call wysiwyg function on button click", async () => {
        renderComponent();

        for (const testCase of Object.values(testCases)) {
            const { label, mockFormatFn } = testCase;

            screen.getByLabelText(label).click();
            expect(mockFormatFn).toHaveBeenCalledTimes(1);
        }
    });

    it("Each button should display the tooltip on mouse over when not disabled", async () => {
        renderComponent();

        for (const testCase of Object.values(testCases)) {
            const { label } = testCase;

            await userEvent.hover(screen.getByLabelText(label));
            await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
        }
    });

    it("Each button should not display the tooltip on mouse over when disabled", async () => {
        const disabledActionStates = createActionStates("disabled");
        renderComponent({ actionStates: disabledActionStates });

        for (const testCase of Object.values(testCases)) {
            const { label } = testCase;

            await userEvent.hover(screen.getByLabelText(label));
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
    });

    it("Each button should have hover style when hovered and enabled", async () => {
        renderComponent();

        for (const testCase of Object.values(testCases)) {
            const { label } = testCase;

            await userEvent.hover(screen.getByLabelText(label));
            expect(screen.getByLabelText(label)).toHaveClass("mx_FormattingButtons_Button_hover");
        }
    });

    it("Each button should not have hover style when hovered and reversed", async () => {
        const reversedActionStates = createActionStates("reversed");
        renderComponent({ actionStates: reversedActionStates });

        for (const testCase of Object.values(testCases)) {
            const { label } = testCase;

            await userEvent.hover(screen.getByLabelText(label));
            expect(screen.getByLabelText(label)).not.toHaveClass("mx_FormattingButtons_Button_hover");
        }
    });

    it("Does not show indent or unindent button when outside a list", () => {
        renderComponent();

        expect(screen.queryByLabelText("Indent increase")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Indent decrease")).not.toBeInTheDocument();
    });

    it("Shows indent and unindent buttons when either a single list type is 'reversed'", () => {
        const orderedListActive = { ...defaultActionStates, orderedList: "reversed" };
        renderComponent({ actionStates: orderedListActive });

        expect(screen.getByLabelText("Indent increase")).toBeInTheDocument();
        expect(screen.getByLabelText("Indent decrease")).toBeInTheDocument();

        cleanup();

        const unorderedListActive = { ...defaultActionStates, unorderedList: "reversed" };

        renderComponent({ actionStates: unorderedListActive });

        expect(screen.getByLabelText("Indent increase")).toBeInTheDocument();
        expect(screen.getByLabelText("Indent decrease")).toBeInTheDocument();
    });
});
