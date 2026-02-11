/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { screen, render, fireEvent, waitFor, within, act } from "jest-matrix-react";

import * as TestUtils from "../../../test-utils";
import type AutocompleteProvider from "../../../../src/autocomplete/AutocompleteProvider";
import { type ICompletion } from "../../../../src/autocomplete/Autocompleter";
import { AutocompleteInput } from "../../../../src/components/structures/AutocompleteInput";

describe("AutocompleteInput", () => {
    const mockCompletion: ICompletion[] = [
        {
            type: "user",
            completion: "user_1",
            completionId: "@user_1:host.local",
            range: { start: 1, end: 1 },
            component: <div />,
        },
        {
            type: "user",
            completion: "user_2",
            completionId: "@user_2:host.local",
            range: { start: 1, end: 1 },
            component: <div />,
        },
    ];

    const constructMockProvider = (data: ICompletion[]) =>
        ({
            getCompletions: jest.fn().mockImplementation(async () => data),
        }) as unknown as AutocompleteProvider;

    beforeEach(() => {
        TestUtils.stubClient();
    });

    const getEditorInput = () => {
        const input = screen.getByTestId("autocomplete-input");
        expect(input).toBeDefined();

        return input;
    };

    it("should render suggestions when a query is set", async () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={[]}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const input = getEditorInput();

        await act(async () => {
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: "user" } });
            await waitFor(() => expect(mockProvider.getCompletions).toHaveBeenCalledTimes(1));
        });

        expect(screen.getByTestId("autocomplete-matches").childNodes).toHaveLength(mockCompletion.length);
    });

    it("should render selected items passed in via props", () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const editor = screen.getByTestId("autocomplete-editor");
        const selection = within(editor).getAllByTestId("autocomplete-selection-item", { exact: false });
        expect(selection).toHaveLength(mockCompletion.length);
    });

    it("should call onSelectionChange() when an item is removed from selection", () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const editor = screen.getByTestId("autocomplete-editor");
        const removeButtons = within(editor).getAllByTestId("autocomplete-selection-remove-button", { exact: false });
        expect(removeButtons).toHaveLength(mockCompletion.length);

        act(() => {
            fireEvent.click(removeButtons[0]);
        });

        expect(onSelectionChangeMock).toHaveBeenCalledTimes(1);
        expect(onSelectionChangeMock).toHaveBeenCalledWith([mockCompletion[1]]);
    });

    it("should render custom selection element when renderSelection() is defined", () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        const renderSelection = () => <span data-testid="custom-selection-element">custom selection element</span>;

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
                renderSelection={renderSelection}
            />,
        );

        expect(screen.getAllByTestId("custom-selection-element")).toHaveLength(mockCompletion.length);
    });

    it("should render custom suggestion element when renderSuggestion() is defined", async () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        const renderSuggestion = () => <span data-testid="custom-suggestion-element">custom suggestion element</span>;

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
                renderSuggestion={renderSuggestion}
            />,
        );

        const input = getEditorInput();

        await act(async () => {
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: "user" } });
            await waitFor(() => expect(mockProvider.getCompletions).toHaveBeenCalledTimes(1));
        });

        expect(screen.getAllByTestId("custom-suggestion-element")).toHaveLength(mockCompletion.length);
    });

    it("should mark selected suggestions as selected", async () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        const { container } = render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const input = getEditorInput();

        act(() => {
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: "user" } });
        });

        await waitFor(() => expect(mockProvider.getCompletions).toHaveBeenCalledTimes(1));
        const suggestions = await within(container).findAllByTestId("autocomplete-suggestion-item", { exact: false });
        expect(suggestions).toHaveLength(mockCompletion.length);
        suggestions.map((suggestion) => expect(suggestion).toHaveClass("mx_AutocompleteInput_suggestion--selected"));
    });

    it("should remove the last added selection when backspace is pressed in empty input", () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={mockCompletion}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const input = getEditorInput();

        act(() => {
            fireEvent.keyDown(input, { key: "Backspace" });
        });

        expect(onSelectionChangeMock).toHaveBeenCalledWith([mockCompletion[0]]);
    });

    it("should toggle a selected item when a suggestion is clicked", async () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        const { container } = render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={[]}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const input = getEditorInput();

        act(() => {
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: "user" } });
        });

        const suggestions = await within(container).findAllByTestId("autocomplete-suggestion-item", { exact: false });

        act(() => {
            fireEvent.mouseDown(suggestions[0]);
        });

        expect(onSelectionChangeMock).toHaveBeenCalledWith([mockCompletion[0]]);
    });

    it("should clear text field and suggestions when a suggestion is accepted", async () => {
        const mockProvider = constructMockProvider(mockCompletion);
        const onSelectionChangeMock = jest.fn();

        const { container } = render(
            <AutocompleteInput
                provider={mockProvider}
                placeholder="Search ..."
                selection={[]}
                onSelectionChange={onSelectionChangeMock}
            />,
        );

        const input = getEditorInput();

        act(() => {
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: "user" } });
        });

        const suggestions = await within(container).findAllByTestId("autocomplete-suggestion-item", { exact: false });

        act(() => {
            fireEvent.mouseDown(suggestions[0]);
        });

        expect(input).toHaveValue("");
        expect(within(container).queryAllByTestId("autocomplete-suggestion-item", { exact: false })).toHaveLength(0);
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });
});
