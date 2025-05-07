/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "@testing-library/jest-dom";
import React, { createRef } from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import { WysiwygAutocomplete } from "../../../../../../../src/components/views/rooms/wysiwyg_composer/components/WysiwygAutocomplete";
import { getRoomContext, mkStubRoom, stubClient } from "../../../../../../test-utils";
import type Autocomplete from "../../../../../../../src/components/views/rooms/Autocomplete";
import Autocompleter, { type ICompletion } from "../../../../../../../src/autocomplete/Autocompleter";
import type AutocompleteProvider from "../../../../../../../src/autocomplete/AutocompleteProvider";
import { ScopedRoomContextProvider } from "../../../../../../../src/contexts/ScopedRoomContext.tsx";

const mockCompletion: ICompletion[] = [
    {
        type: "user",
        completion: "user_1",
        completionId: "@user_1:host.local",
        range: { start: 1, end: 1 },
        component: <div>user_1</div>,
    },
    {
        type: "user",
        completion: "user_2",
        completionId: "@user_2:host.local",
        range: { start: 1, end: 1 },
        component: <div>user_2</div>,
    },
];

const constructMockProvider = (data: ICompletion[]) =>
    ({
        getCompletions: jest.fn().mockImplementation(async () => data),
        getName: jest.fn().mockReturnValue("test provider"),
        renderCompletions: jest.fn().mockImplementation((components) => components),
    }) as unknown as AutocompleteProvider;

beforeAll(initOnce, 10000);

describe("WysiwygAutocomplete", () => {
    beforeAll(() => {
        // scrollTo not implemented in JSDOM
        window.HTMLElement.prototype.scrollTo = function () {};
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    const autocompleteRef = createRef<Autocomplete>();
    const getCompletionsSpy = jest.spyOn(Autocompleter.prototype, "getCompletions").mockResolvedValue([
        {
            completions: mockCompletion,
            provider: constructMockProvider(mockCompletion),
            command: { command: ["truthy"] as RegExpExecArray }, // needed for us to unhide the autocomplete when testing
        },
    ]);
    const mockHandleMention = jest.fn();
    const mockHandleCommand = jest.fn();
    const mockHandleAtRoomMention = jest.fn();

    const renderComponent = (props: Partial<React.ComponentProps<typeof WysiwygAutocomplete>> = {}) => {
        const mockClient = stubClient();
        const mockRoom = mkStubRoom("test_room", "test_room", mockClient);
        const mockRoomContext = getRoomContext(mockRoom, {});

        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...mockRoomContext}>
                    <WysiwygAutocomplete
                        ref={autocompleteRef}
                        suggestion={null}
                        handleMention={mockHandleMention}
                        handleCommand={mockHandleCommand}
                        handleAtRoomMention={mockHandleAtRoomMention}
                        {...props}
                    />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    };

    it("does not show the autocomplete when room is undefined", () => {
        render(
            <WysiwygAutocomplete
                ref={autocompleteRef}
                suggestion={null}
                handleMention={mockHandleMention}
                handleCommand={mockHandleCommand}
                handleAtRoomMention={mockHandleAtRoomMention}
            />,
        );
        expect(screen.queryByTestId("autocomplete-wrapper")).not.toBeInTheDocument();
    });

    it("does not call for suggestions with a null suggestion prop", async () => {
        // render the component, the default props have suggestion = null
        renderComponent();

        // check that getCompletions is not called, and we have no suggestions
        expect(getCompletionsSpy).not.toHaveBeenCalled();
        expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    });

    it("calls getCompletions when given a valid suggestion prop", async () => {
        renderComponent({ suggestion: { keyChar: "@", text: "abc", type: "mention" } });

        // wait for getCompletions to have been called
        await waitFor(() => {
            expect(getCompletionsSpy).toHaveBeenCalled();
        });

        // check that some suggestions are shown
        expect(screen.getByRole("presentation")).toBeInTheDocument();

        // and that they are the mock completions
        mockCompletion.forEach(({ completion }) => expect(screen.getByText(completion)).toBeInTheDocument());
    });
});
