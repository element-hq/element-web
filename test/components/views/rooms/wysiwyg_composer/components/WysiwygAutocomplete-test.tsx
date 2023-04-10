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

import "@testing-library/jest-dom";
import React, { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../../src/contexts/RoomContext";
import { WysiwygAutocomplete } from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/WysiwygAutocomplete";
import { getRoomContext, mkStubRoom, stubClient } from "../../../../../test-utils";
import Autocomplete from "../../../../../../src/components/views/rooms/Autocomplete";
import Autocompleter, { ICompletion } from "../../../../../../src/autocomplete/Autocompleter";
import AutocompleteProvider from "../../../../../../src/autocomplete/AutocompleteProvider";

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
    } as unknown as AutocompleteProvider);

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

    const renderComponent = (props: Partial<React.ComponentProps<typeof WysiwygAutocomplete>> = {}) => {
        const mockClient = stubClient();
        const mockRoom = mkStubRoom("test_room", "test_room", mockClient);
        const mockRoomContext = getRoomContext(mockRoom, {});

        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={mockRoomContext}>
                    <WysiwygAutocomplete
                        ref={autocompleteRef}
                        suggestion={null}
                        handleMention={mockHandleMention}
                        handleCommand={mockHandleCommand}
                        {...props}
                    />
                </RoomContext.Provider>
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
