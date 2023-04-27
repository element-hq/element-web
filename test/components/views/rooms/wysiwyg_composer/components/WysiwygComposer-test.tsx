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

import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WysiwygComposer } from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/WysiwygComposer";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { flushPromises, mockPlatformPeg, stubClient, mkStubRoom } from "../../../../../test-utils";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";
import * as EventUtils from "../../../../../../src/utils/EventUtils";
import { Action } from "../../../../../../src/dispatcher/actions";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../../src/contexts/RoomContext";
import {
    ComposerContext,
    getDefaultContextValue,
} from "../../../../../../src/components/views/rooms/wysiwyg_composer/ComposerContext";
import { createMocks } from "../utils";
import EditorStateTransfer from "../../../../../../src/utils/EditorStateTransfer";
import { SubSelection } from "../../../../../../src/components/views/rooms/wysiwyg_composer/types";
import { setSelection } from "../../../../../../src/components/views/rooms/wysiwyg_composer/utils/selection";
import { parseEditorStateTransfer } from "../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/useInitialContent";
import Autocompleter, { ICompletion } from "../../../../../../src/autocomplete/Autocompleter";
import AutocompleteProvider from "../../../../../../src/autocomplete/AutocompleteProvider";
import * as Permalinks from "../../../../../../src/utils/permalinks/Permalinks";
import { PermalinkParts } from "../../../../../../src/utils/permalinks/PermalinkConstructor";

describe("WysiwygComposer", () => {
    const customRender = (onChange = jest.fn(), onSend = jest.fn(), disabled = false, initialContent?: string) => {
        const { mockClient, defaultRoomContext } = createMocks();
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={defaultRoomContext}>
                    <WysiwygComposer
                        onChange={onChange}
                        onSend={onSend}
                        disabled={disabled}
                        initialContent={initialContent}
                    />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Should have contentEditable at false when disabled", async () => {
        // When
        customRender(jest.fn(), jest.fn(), true);

        // Then
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "false"));
    });

    describe("Standard behavior", () => {
        const onChange = jest.fn();
        const onSend = jest.fn();
        beforeEach(async () => {
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            customRender(onChange, onSend);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            onChange.mockReset();
            onSend.mockReset();
        });

        it("Should have contentEditable at true", async () => {
            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        it("Should have focus", async () => {
            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
        });

        it("Should call onChange handler", async () => {
            // When
            fireEvent.input(screen.getByRole("textbox"), {
                data: "foo bar",
                inputType: "insertText",
            });

            // Then
            await waitFor(() => expect(onChange).toHaveBeenCalledWith("foo bar"));
        });

        it("Should call onSend when Enter is pressed", async () => {
            //When
            fireEvent(
                screen.getByRole("textbox"),
                new InputEvent("input", {
                    inputType: "insertParagraph",
                }),
            );

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
        });

        it("Should not call onSend when Shift+Enter is pressed", async () => {
            //When
            await userEvent.type(screen.getByRole("textbox"), "{shift>}{enter}");

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(0));
        });

        it("Should not call onSend when ctrl+Enter is pressed", async () => {
            //When
            // Using userEvent.type or .keyboard wasn't working as expected in the case of ctrl+enter
            fireEvent(
                screen.getByRole("textbox"),
                new KeyboardEvent("keydown", {
                    ctrlKey: true,
                    code: "Enter",
                }),
            );

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(0));
        });

        it("Should not call onSend when alt+Enter is pressed", async () => {
            //When
            await userEvent.type(screen.getByRole("textbox"), "{alt>}{enter}");

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(0));
        });

        it("Should not call onSend when meta+Enter is pressed", async () => {
            //When
            await userEvent.type(screen.getByRole("textbox"), "{meta>}{enter}");

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(0));
        });
    });

    describe("Mentions and commands", () => {
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

        const mockCompletions: ICompletion[] = [
            {
                type: "user",
                href: "www.user1.com",
                completion: "user_1",
                completionId: "@user_1:host.local",
                range: { start: 1, end: 1 },
                component: <div>user_1</div>,
            },
            {
                type: "user",
                href: "www.user2.com",
                completion: "user_2",
                completionId: "@user_2:host.local",
                range: { start: 1, end: 1 },
                component: <div>user_2</div>,
            },
            {
                // no href user
                type: "user",
                href: undefined,
                completion: "user_without_href",
                completionId: "@user_3:host.local",
                range: { start: 1, end: 1 },
                component: <div>user_without_href</div>,
            },
            {
                type: "room",
                href: "www.room1.com",
                completion: "#room_with_completion_id",
                completionId: "@room_1:host.local",
                range: { start: 1, end: 1 },
                component: <div>room_with_completion_id</div>,
            },
            {
                type: "room",
                href: "www.room2.com",
                completion: "#room_without_completion_id",
                range: { start: 1, end: 1 },
                component: <div>room_without_completion_id</div>,
            },
            {
                type: "command",
                completion: "/spoiler",
                range: { start: 1, end: 1 },
                component: <div>/spoiler</div>,
            },
            {
                type: "at-room",
                completion: "@room",
                range: { start: 1, end: 1 },
                component: <div>@room</div>,
            },
            {
                type: "community",
                completion: "community-completion",
                range: { start: 1, end: 1 },
                component: <div>community</div>,
            },
        ];

        const constructMockProvider = (data: ICompletion[]) =>
            ({
                getCompletions: jest.fn().mockImplementation(async () => data),
                getName: jest.fn().mockReturnValue("test provider"),
                renderCompletions: jest.fn().mockImplementation((components) => components),
            } as unknown as AutocompleteProvider);

        // for each test we will insert input simulating a user mention
        const initialInput = "@abc";
        const insertMentionInput = async () => {
            fireEvent.input(screen.getByRole("textbox"), {
                data: initialInput,
                inputType: "insertText",
            });

            // the autocomplete suggestions container has the presentation role, wait for it to be present
            expect(await screen.findByRole("presentation")).toBeInTheDocument();
        };

        beforeEach(async () => {
            // setup the required spies
            jest.spyOn(Autocompleter.prototype, "getCompletions").mockResolvedValue([
                {
                    completions: mockCompletions,
                    provider: constructMockProvider(mockCompletions),
                    command: { command: ["truthy"] as RegExpExecArray }, // needed for us to unhide the autocomplete when testing
                },
            ]);
            jest.spyOn(Permalinks, "parsePermalink").mockReturnValue({
                userId: "mockParsedUserId",
            } as unknown as PermalinkParts);

            // then render the component and wait for the composer to be ready
            customRender();
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("shows the autocomplete when text has @ prefix and autoselects the first item", async () => {
            await insertMentionInput();
            expect(screen.getByText(mockCompletions[0].completion)).toHaveAttribute("aria-selected", "true");
        });

        it("pressing up and down arrows allows us to change the autocomplete selection", async () => {
            await insertMentionInput();

            // press the down arrow - nb using .keyboard allows us to not have to specify a node, which
            // means that we know the autocomplete is correctly catching the event
            await userEvent.keyboard("{ArrowDown}");
            expect(screen.getByText(mockCompletions[0].completion)).toHaveAttribute("aria-selected", "false");
            expect(screen.getByText(mockCompletions[1].completion)).toHaveAttribute("aria-selected", "true");

            // reverse the process and check again
            await userEvent.keyboard("{ArrowUp}");
            expect(screen.getByText(mockCompletions[0].completion)).toHaveAttribute("aria-selected", "true");
            expect(screen.getByText(mockCompletions[1].completion)).toHaveAttribute("aria-selected", "false");
        });

        it("pressing enter selects the mention and inserts it into the composer as a link", async () => {
            await insertMentionInput();

            // press enter
            await userEvent.keyboard("{Enter}");

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });

            // check that it inserts the completion text as a link
            expect(screen.getByRole("link", { name: mockCompletions[0].completion })).toBeInTheDocument();
        });

        it("pressing escape closes the autocomplete", async () => {
            await insertMentionInput();

            // press escape
            await userEvent.keyboard("{Escape}");

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });
        });

        it("typing with the autocomplete open still works as expected", async () => {
            await insertMentionInput();

            // add some more text, then check the autocomplete is open AND the text is in the composer
            await userEvent.keyboard("extra");

            expect(screen.queryByRole("presentation")).toBeInTheDocument();
            expect(screen.getByRole("textbox")).toHaveTextContent("@abcextra");
        });

        it("clicking on a mention in the composer dispatches the correct action", async () => {
            await insertMentionInput();

            // press enter
            await userEvent.keyboard("{Enter}");

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });

            // click on the user mention link that has been inserted
            await userEvent.click(screen.getByRole("link", { name: mockCompletions[0].completion }));
            expect(dispatchSpy).toHaveBeenCalledTimes(1);

            // this relies on the output from the mock function in mkStubRoom
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewUser,
                    member: expect.objectContaining({
                        userId: mkStubRoom(undefined, undefined, undefined).getMember("any")?.userId,
                    }),
                }),
            );
        });

        it("selecting a mention without a href closes the autocomplete but does not insert a mention", async () => {
            await insertMentionInput();

            // select the relevant user by clicking
            await userEvent.click(screen.getByText("user_without_href"));

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });

            // check that it has not inserted a link
            expect(screen.queryByRole("link", { name: "user_without_href" })).not.toBeInTheDocument();
        });

        it("selecting a room mention with a completionId uses client.getRoom", async () => {
            await insertMentionInput();

            // select the room suggestion by clicking
            await userEvent.click(screen.getByText("room_with_completion_id"));

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });

            // check that it has inserted a link and looked up the name from the mock client
            // which will always return 'My room'
            expect(screen.getByRole("link", { name: "My room" })).toBeInTheDocument();
        });

        it("selecting a room mention without a completionId uses client.getRooms", async () => {
            await insertMentionInput();

            // select the room suggestion
            await userEvent.click(screen.getByText("room_without_completion_id"));

            // check that it closes the autocomplete
            await waitFor(() => {
                expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
            });

            // check that it has inserted a link and falls back to the completion text
            expect(screen.getByRole("link", { name: "#room_without_completion_id" })).toBeInTheDocument();
        });

        it("selecting a command inserts the command", async () => {
            await insertMentionInput();

            // select the room suggestion
            await userEvent.click(screen.getByText("/spoiler"));

            // check that it has inserted the plain text
            expect(screen.getByText("/spoiler")).toBeInTheDocument();
        });

        it("selecting an at-room completion inserts @room", async () => {
            await insertMentionInput();

            // select the room suggestion
            await userEvent.click(screen.getByText("@room"));

            // check that it has inserted the @room link
            expect(screen.getByRole("link", { name: "@room" })).toBeInTheDocument();
        });

        it("allows a community completion to pass through", async () => {
            await insertMentionInput();

            // select the room suggestion
            await userEvent.click(screen.getByText("community"));

            // check that it we still have the initial text
            expect(screen.getByText(initialInput)).toBeInTheDocument();
        });
    });

    describe("When settings require Ctrl+Enter to send", () => {
        const onChange = jest.fn();
        const onSend = jest.fn();
        beforeEach(async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                if (name === "MessageComposerInput.ctrlEnterToSend") return true;
            });
            customRender(onChange, onSend);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            onChange.mockReset();
            onSend.mockReset();
        });

        it("Should not call onSend when Enter is pressed", async () => {
            // When
            const textbox = screen.getByRole("textbox");

            fireEvent(
                textbox,
                new InputEvent("input", {
                    inputType: "insertParagraph",
                }),
            );

            // Then it does not send a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(0));

            fireEvent(
                textbox,
                new InputEvent("input", {
                    inputType: "insertText",
                    data: "other",
                }),
            );

            // The focus is on the last text node
            await waitFor(() => {
                const selection = document.getSelection();
                if (selection) {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(selection.focusNode?.textContent).toEqual("other");
                }
            });
        });

        it("Should send a message when Ctrl+Enter is pressed", async () => {
            // When
            fireEvent(
                screen.getByRole("textbox"),
                new InputEvent("input", {
                    inputType: "sendMessage",
                }),
            );

            // Then it sends a message
            await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
        });
    });

    describe("Keyboard navigation", () => {
        const { mockClient, defaultRoomContext, mockEvent, editorStateTransfer } = createMocks();

        const customRender = (
            client = mockClient,
            roomContext = defaultRoomContext,
            _editorStateTransfer?: EditorStateTransfer,
        ) => {
            return render(
                <MatrixClientContext.Provider value={client}>
                    <RoomContext.Provider value={roomContext}>
                        <ComposerContext.Provider
                            value={getDefaultContextValue({ editorStateTransfer: _editorStateTransfer })}
                        >
                            <WysiwygComposer
                                onChange={jest.fn()}
                                onSend={jest.fn()}
                                initialContent={
                                    roomContext.room && _editorStateTransfer
                                        ? parseEditorStateTransfer(_editorStateTransfer, roomContext.room, client)
                                        : undefined
                                }
                            />
                        </ComposerContext.Provider>
                    </RoomContext.Provider>
                </MatrixClientContext.Provider>,
            );
        };

        afterEach(() => {
            jest.resetAllMocks();
        });

        const setup = async (
            editorState?: EditorStateTransfer,
            client = stubClient(),
            roomContext = defaultRoomContext,
        ) => {
            const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

            customRender(client, roomContext, editorState);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
            return { textbox: screen.getByRole("textbox"), spyDispatcher };
        };

        beforeEach(() => {
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(mockEvent);
        });

        describe("In message creation", () => {
            it("Should not moving when the composer is filled", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
                fireEvent.input(textbox, {
                    data: "word",
                    inputType: "insertText",
                });

                // Move at the beginning of the composer
                fireEvent.keyDown(textbox, {
                    key: "ArrowUp",
                });

                // Then
                expect(spyDispatcher).toHaveBeenCalledTimes(0);
            });

            it("Should moving when the composer is empty", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();

                fireEvent.keyDown(textbox, {
                    key: "ArrowUp",
                });

                // Then
                expect(spyDispatcher).toHaveBeenCalledWith({
                    action: Action.EditEvent,
                    event: mockEvent,
                    timelineRenderingType: defaultRoomContext.timelineRenderingType,
                });
            });
        });

        describe("In message editing", () => {
            function select(selection: SubSelection) {
                return act(async () => {
                    await setSelection(selection);
                    // the event is not automatically fired by jest
                    document.dispatchEvent(new CustomEvent("selectionchange"));
                });
            }

            describe("Moving up", () => {
                it("Should not moving when caret is not at beginning of the text", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    const textNode = textbox.firstChild;
                    await select({
                        anchorNode: textNode,
                        anchorOffset: 1,
                        focusNode: textNode,
                        focusOffset: 2,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowUp",
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledTimes(0);
                });

                it("Should not moving when the content has changed", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    fireEvent.input(textbox, {
                        data: "word",
                        inputType: "insertText",
                    });
                    const textNode = textbox.firstChild;
                    await select({
                        anchorNode: textNode,
                        anchorOffset: 0,
                        focusNode: textNode,
                        focusOffset: 0,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowUp",
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledTimes(0);
                });

                it("Should moving up", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    const textNode = textbox.firstChild;
                    await select({
                        anchorNode: textNode,
                        anchorOffset: 0,
                        focusNode: textNode,
                        focusOffset: 0,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowUp",
                    });

                    // Wait for event dispatch to happen
                    await act(async () => {
                        await flushPromises();
                    });

                    // Then
                    await waitFor(() =>
                        expect(spyDispatcher).toHaveBeenCalledWith({
                            action: Action.EditEvent,
                            event: mockEvent,
                            timelineRenderingType: defaultRoomContext.timelineRenderingType,
                        }),
                    );
                });

                it("Should moving up in list", async () => {
                    // When
                    const { mockEvent, defaultRoomContext, mockClient, editorStateTransfer } = createMocks(
                        "<ul><li><strong>Content</strong></li><li>Other Content</li></ul>",
                    );
                    jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(mockEvent);
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer, mockClient, defaultRoomContext);

                    const textNode = textbox.firstChild;
                    await select({
                        anchorNode: textNode,
                        anchorOffset: 0,
                        focusNode: textNode,
                        focusOffset: 0,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowUp",
                    });

                    // Wait for event dispatch to happen
                    await act(async () => {
                        await flushPromises();
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledWith({
                        action: Action.EditEvent,
                        event: mockEvent,
                        timelineRenderingType: defaultRoomContext.timelineRenderingType,
                    });
                });
            });

            describe("Moving down", () => {
                it("Should not moving when caret is not at the end of the text", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    const brNode = textbox.lastChild;
                    await select({
                        anchorNode: brNode,
                        anchorOffset: 0,
                        focusNode: brNode,
                        focusOffset: 0,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowDown",
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledTimes(0);
                });

                it("Should not moving when the content has changed", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    fireEvent.input(textbox, {
                        data: "word",
                        inputType: "insertText",
                    });
                    const brNode = textbox.lastChild;
                    await select({
                        anchorNode: brNode,
                        anchorOffset: 0,
                        focusNode: brNode,
                        focusOffset: 0,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowDown",
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledTimes(0);
                });

                it("Should moving down", async () => {
                    // When
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    // Skipping the BR tag
                    const textNode = textbox.childNodes[textbox.childNodes.length - 2];
                    const { length } = textNode.textContent || "";
                    await select({
                        anchorNode: textNode,
                        anchorOffset: length,
                        focusNode: textNode,
                        focusOffset: length,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowDown",
                    });

                    // Wait for event dispatch to happen
                    await act(async () => {
                        await flushPromises();
                    });

                    // Then
                    await waitFor(() =>
                        expect(spyDispatcher).toHaveBeenCalledWith({
                            action: Action.EditEvent,
                            event: mockEvent,
                            timelineRenderingType: defaultRoomContext.timelineRenderingType,
                        }),
                    );
                });

                it("Should moving down in list", async () => {
                    // When
                    const { mockEvent, defaultRoomContext, mockClient, editorStateTransfer } = createMocks(
                        "<ul><li><strong>Content</strong></li><li>Other Content</li></ul>",
                    );
                    jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(mockEvent);
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer, mockClient, defaultRoomContext);

                    // Skipping the BR tag and get the text node inside the last LI tag
                    const textNode = textbox.childNodes[textbox.childNodes.length - 2].lastChild?.lastChild || textbox;
                    const { length } = textNode.textContent || "";
                    await select({
                        anchorNode: textNode,
                        anchorOffset: length,
                        focusNode: textNode,
                        focusOffset: length,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowDown",
                    });

                    // Wait for event dispatch to happen
                    await act(async () => {
                        await flushPromises();
                    });

                    // Then
                    expect(spyDispatcher).toHaveBeenCalledWith({
                        action: Action.EditEvent,
                        event: mockEvent,
                        timelineRenderingType: defaultRoomContext.timelineRenderingType,
                    });
                });

                it("Should close editing", async () => {
                    // When
                    jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(undefined);
                    const { textbox, spyDispatcher } = await setup(editorStateTransfer);
                    // Skipping the BR tag
                    const textNode = textbox.childNodes[textbox.childNodes.length - 2];
                    const { length } = textNode.textContent || "";
                    await select({
                        anchorNode: textNode,
                        anchorOffset: length,
                        focusNode: textNode,
                        focusOffset: length,
                        isForward: true,
                    });

                    fireEvent.keyDown(textbox, {
                        key: "ArrowDown",
                    });

                    // Wait for event dispatch to happen
                    await act(async () => {
                        await flushPromises();
                    });

                    // Then
                    await waitFor(() =>
                        expect(spyDispatcher).toHaveBeenCalledWith({
                            action: Action.EditEvent,
                            event: null,
                            timelineRenderingType: defaultRoomContext.timelineRenderingType,
                        }),
                    );
                });
            });
        });
    });
});
