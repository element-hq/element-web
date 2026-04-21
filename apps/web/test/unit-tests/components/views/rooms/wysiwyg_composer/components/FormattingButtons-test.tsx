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
import Modal from "../../../../../../../src/Modal";
import { setLanguage } from "../../../../../../../src/languageHandler";

// For these, we just expect the corresponding function to be called as soon as the button is clicked
const simpleCases: Record<Exclude<ActionTypes, "undo" | "redo" | "clear" | "indent" | "unindent" | "link">, string> = {
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    strikeThrough: "Strikethrough",
    inlineCode: "Code",
    codeBlock: "Code block",
    orderedList: "Numbered list",
    unorderedList: "Bulleted list",
    quote: "Quote",
};

const testCases = {
    ...simpleCases,
    link: "Link",
};

const createActionStates = (state: ActionState): AllActionStates => {
    return Object.fromEntries(Object.keys(testCases).map((testKey) => [testKey, state])) as AllActionStates;
};

const defaultActionStates = createActionStates("enabled");

const renderComponent = (mockWysiwyg: FormattingFunctions, props = {}) => {
    return render(<FormattingButtons composer={mockWysiwyg} actionStates={defaultActionStates} {...props} />);
};

const classes = {
    active: "mx_FormattingButtons_active",
    hover: "mx_FormattingButtons_Button_hover",
    disabled: "mx_FormattingButtons_disabled",
};

describe("FormattingButtons", () => {
    let mockWysiwyg: FormattingFunctions;

    beforeEach(() => {
        cleanup();
        mockWysiwyg = {} as unknown as FormattingFunctions;
    });

    afterEach(() => {
        jest.resetAllMocks();
        Modal.forceCloseAllModals();
    });

    it("renders in german", async () => {
        await setLanguage("de");
        const { asFragment } = renderComponent(mockWysiwyg);
        expect(asFragment()).toMatchSnapshot();

        await setLanguage("en");
    });

    it("Each button should not have active class when enabled", () => {
        renderComponent(mockWysiwyg);

        Object.values(testCases).forEach((label) => {
            expect(screen.getByLabelText(label)).not.toHaveClass(classes.active);
        });
    });

    it("Each button should have active class when reversed", () => {
        const reversedActionStates = createActionStates("reversed");
        renderComponent(mockWysiwyg, { actionStates: reversedActionStates });

        Object.values(testCases).forEach((label) => {
            expect(screen.getByLabelText(label)).toHaveClass(classes.active);
        });
    });

    it("Each button should have disabled class when disabled", () => {
        const disabledActionStates = createActionStates("disabled");
        renderComponent(mockWysiwyg, { actionStates: disabledActionStates });

        Object.values(testCases).forEach((label) => {
            expect(screen.getByLabelText(label)).toHaveClass(classes.disabled);
        });
    });

    it.each(Object.keys(simpleCases))("Should call wysiwyg function on button click (%s)", async (key) => {
        const user = userEvent.setup();

        renderComponent(mockWysiwyg);

        const mock = (mockWysiwyg[key as keyof FormattingFunctions] = jest.fn());
        await user.click(screen.getByLabelText(simpleCases[key as keyof typeof simpleCases]));
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it("should open link modal after clicking link button", async () => {
        const openLinkModalSpy = jest.spyOn(LinkModal, "openLinkModal");

        const user = userEvent.setup();

        renderComponent(mockWysiwyg);

        await user.click(screen.getByLabelText(testCases.link));
        expect(openLinkModalSpy).toHaveBeenCalledTimes(1);
    });

    it.each(Object.keys(testCases))(
        "%s button should display the tooltip on mouse over when not disabled",
        async (key) => {
            const user = userEvent.setup();

            renderComponent(mockWysiwyg);

            await user.hover(screen.getByLabelText(testCases[key as keyof typeof testCases]));
            await waitFor(() => expect(screen.getByText(testCases[key as keyof typeof testCases])).toBeInTheDocument());
        },
    );

    it.each(Object.keys(testCases))(
        "%s button should not display the tooltip on mouse over when disabled",
        async (key) => {
            const user = userEvent.setup();

            const disabledActionStates = createActionStates("disabled");
            renderComponent(mockWysiwyg, { actionStates: disabledActionStates });

            await user.hover(screen.getByLabelText(testCases[key as keyof typeof testCases]));
            expect(screen.queryByText(testCases[key as keyof typeof testCases])).not.toBeInTheDocument();
        },
    );

    it.each(Object.keys(testCases))("%s button should have hover style when hovered and enabled", async (key) => {
        const user = userEvent.setup();

        renderComponent(mockWysiwyg);

        await user.hover(screen.getByLabelText(testCases[key as keyof typeof testCases]));
        expect(screen.getByLabelText(testCases[key as keyof typeof testCases])).toHaveClass(
            "mx_FormattingButtons_Button_hover",
        );
    });

    it.each(Object.keys(testCases))("%s button should not have hover style when hovered and reversed", async (key) => {
        const user = userEvent.setup();

        const reversedActionStates = createActionStates("reversed");
        renderComponent(mockWysiwyg, { actionStates: reversedActionStates });

        await user.hover(screen.getByLabelText(testCases[key as keyof typeof testCases]));
        expect(screen.getByLabelText(testCases[key as keyof typeof testCases])).not.toHaveClass(
            "mx_FormattingButtons_Button_hover",
        );
    });

    it("Does not show indent or unindent button when outside a list", () => {
        renderComponent(mockWysiwyg);

        expect(screen.queryByLabelText("Indent increase")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Indent decrease")).not.toBeInTheDocument();
    });

    it("Shows indent and unindent buttons when either a single list type is 'reversed'", () => {
        const orderedListActive = { ...defaultActionStates, orderedList: "reversed" };
        renderComponent(mockWysiwyg, { actionStates: orderedListActive });

        expect(screen.getByLabelText("Indent increase")).toBeInTheDocument();
        expect(screen.getByLabelText("Indent decrease")).toBeInTheDocument();

        cleanup();

        const unorderedListActive = { ...defaultActionStates, unorderedList: "reversed" };

        renderComponent(mockWysiwyg, { actionStates: unorderedListActive });

        expect(screen.getByLabelText("Indent increase")).toBeInTheDocument();
        expect(screen.getByLabelText("Indent decrease")).toBeInTheDocument();
    });

    it.each(Object.keys(testCases))("%s button should be disabled when the component is disabled", (key) => {
        renderComponent(mockWysiwyg, { disabled: true });

        const label = testCases[key as keyof typeof testCases];
        expect(screen.getByLabelText(label)).toHaveClass(classes.disabled);
        expect(screen.getByLabelText(label)).toBeDisabled();
    });
});
