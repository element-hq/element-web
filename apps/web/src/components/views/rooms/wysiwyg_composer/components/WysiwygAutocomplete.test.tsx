/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React, { createRef } from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import { getRoomContext, mkStubRoom, stubClient } from "test-utils";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { WysiwygAutocomplete } from "./WysiwygAutocomplete";
import type Autocomplete from "../../Autocomplete";
import Autocompleter, { type ICompletion } from "../../../../../autocomplete/Autocompleter";
import type AutocompleteProvider from "../../../../../autocomplete/AutocompleteProvider";
import { ScopedRoomContextProvider } from "../../../../../contexts/ScopedRoomContext.tsx";

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
        getCompletions: vi.fn().mockImplementation(async () => data),
        getName: vi.fn().mockReturnValue("test provider"),
        renderCompletions: vi.fn().mockImplementation((components) => components),
    }) as unknown as AutocompleteProvider;

beforeAll(initOnce, 10000);

describe("WysiwygAutocomplete", () => {
    beforeAll(() => {
        // scrollTo not implemented in JSDOM
        window.HTMLElement.prototype.scrollTo = function () {};
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    const autocompleteRef = createRef<Autocomplete>();
    const getCompletionsSpy = vi.spyOn(Autocompleter.prototype, "getCompletions").mockResolvedValue([
        {
            completions: mockCompletion,
            provider: constructMockProvider(mockCompletion),
            command: { command: ["truthy"] as RegExpExecArray }, // needed for us to unhide the autocomplete when testing
        },
    ]);
    const mockHandleMention = vi.fn();
    const mockHandleCommand = vi.fn();
    const mockHandleAtRoomMention = vi.fn();
    const mockHandleEmoji = vi.fn();

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
                        handleEmoji={mockHandleEmoji}
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
                handleEmoji={mockHandleEmoji}
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
