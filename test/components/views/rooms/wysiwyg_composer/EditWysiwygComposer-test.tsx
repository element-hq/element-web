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
import { EventTimeline, MatrixEvent } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../src/contexts/RoomContext";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import {
    createTestClient,
    flushPromises,
    getRoomContext,
    mkEvent,
    mkStubRoom,
    mockPlatformPeg,
} from "../../../../test-utils";
import { EditWysiwygComposer } from "../../../../../src/components/views/rooms/wysiwyg_composer";
import EditorStateTransfer from "../../../../../src/utils/EditorStateTransfer";
import { Emoji } from "../../../../../src/components/views/rooms/wysiwyg_composer/components/Emoji";
import { ChevronFace } from "../../../../../src/components/structures/ContextMenu";
import dis from "../../../../../src/dispatcher/dispatcher";
import { ComposerInsertPayload, ComposerType } from "../../../../../src/dispatcher/payloads/ComposerInsertPayload";
import { ActionPayload } from "../../../../../src/dispatcher/payloads";
import * as EmojiButton from "../../../../../src/components/views/rooms/EmojiButton";
import { setSelection } from "../../../../../src/components/views/rooms/wysiwyg_composer/utils/selection";
import * as EventUtils from "../../../../../src/utils/EventUtils";
import { SubSelection } from "../../../../../src/components/views/rooms/wysiwyg_composer/types";

describe("EditWysiwygComposer", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    function createMocks(eventContent = "Replying <strong>to</strong> this new content") {
        const mockClient = createTestClient();
        const mockEvent = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: {
                msgtype: "m.text",
                body: "Replying to this",
                format: "org.matrix.custom.html",
                formatted_body: eventContent,
            },
            event: true,
        });
        const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        mockRoom.findEventById = jest.fn((eventId) => {
            return eventId === mockEvent.getId() ? mockEvent : null;
        });

        const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {
            liveTimeline: { getEvents: (): MatrixEvent[] => [] } as unknown as EventTimeline,
        });

        const editorStateTransfer = new EditorStateTransfer(mockEvent);

        return { defaultRoomContext, editorStateTransfer, mockClient, mockEvent };
    }

    const { editorStateTransfer, defaultRoomContext, mockClient, mockEvent } = createMocks();

    const customRender = (
        disabled = false,
        _editorStateTransfer = editorStateTransfer,
        client = mockClient,
        roomContext = defaultRoomContext,
    ) => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={roomContext}>
                    <EditWysiwygComposer disabled={disabled} editorStateTransfer={_editorStateTransfer} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    beforeAll(() => {
        // Load the dynamic import
        customRender(false).unmount();
    });

    it("Should not render the component when not ready", async () => {
        // When
        const { rerender } = customRender(false);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

        rerender(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={{ ...defaultRoomContext, room: undefined }}>
                    <EditWysiwygComposer disabled={false} editorStateTransfer={editorStateTransfer} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );

        // Then
        await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    });

    describe("Initialize with content", () => {
        it("Should initialize useWysiwyg with html content", async () => {
            // When
            customRender(false, editorStateTransfer);

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"), {
                timeout: 2000,
            });

            await waitFor(() =>
                expect(screen.getByRole("textbox")).toContainHTML(mockEvent.getContent()["formatted_body"]),
            );
        });

        it("Should initialize useWysiwyg with plain text content", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                },
                event: true,
            });
            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toContainHTML(mockEvent.getContent()["body"]));
        });

        it("Should ignore when formatted_body is not filled", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                    format: "org.matrix.custom.html",
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        it("Should strip <mx-reply> tag from initial content", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                    format: "org.matrix.custom.html",
                    formatted_body: "<mx-reply>Reply</mx-reply>My content",
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            // Then
            await waitFor(() => {
                expect(screen.getByRole("textbox")).not.toContainHTML("<mx-reply>Reply</mx-reply>");
                expect(screen.getByRole("textbox")).toContainHTML("My content");
            });
        });
    });

    describe("Edit and save actions", () => {
        let spyDispatcher: jest.SpyInstance<void, [payload: ActionPayload, sync?: boolean]>;
        beforeEach(async () => {
            spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");
            customRender();
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            spyDispatcher.mockRestore();
        });

        it("Should cancel edit on cancel button click", async () => {
            // When
            screen.getByText("Cancel").click();

            // Then
            expect(spyDispatcher).toBeCalledWith({
                action: Action.EditEvent,
                event: null,
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
            expect(spyDispatcher).toBeCalledWith({
                action: Action.FocusSendMessageComposer,
                context: defaultRoomContext.timelineRenderingType,
            });
        });

        it("Should send message on save button click", async () => {
            // When
            fireEvent.input(screen.getByRole("textbox"), {
                data: "foo bar",
                inputType: "insertText",
            });
            await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));

            // Then
            screen.getByText("Save").click();
            const expectedContent = {
                "body": ` * foo bar`,
                "format": "org.matrix.custom.html",
                "formatted_body": ` * foo bar`,
                "m.new_content": {
                    body: "foo bar",
                    format: "org.matrix.custom.html",
                    formatted_body: "foo bar",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: mockEvent.getId(),
                    rel_type: "m.replace",
                },
                "msgtype": "m.text",
            };
            await waitFor(() =>
                expect(mockClient.sendMessage).toBeCalledWith(mockEvent.getRoomId(), null, expectedContent),
            );

            expect(spyDispatcher).toBeCalledWith({ action: "message_sent" });
        });
    });

    it("Should focus when receiving an Action.FocusEditMessageComposer action", async () => {
        // Given we don't have focus
        customRender();
        screen.getByLabelText("Bold").focus();
        expect(screen.getByRole("textbox")).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    });

    it("Should not focus when disabled", async () => {
        // Given we don't have focus and we are disabled
        customRender(true);
        screen.getByLabelText("Bold").focus();
        expect(screen.getByRole("textbox")).not.toHaveFocus();

        // When we send an action that would cause us to get focus
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });
        // (Send a second event to exercise the clearTimeout logic)
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });

        // Wait for event dispatch to happen
        await act(async () => {
            await flushPromises();
        });

        // Then we don't get it because we are disabled
        expect(screen.getByRole("textbox")).not.toHaveFocus();
    });

    it("Should add emoji", async () => {
        // When

        // We are not testing here the emoji button (open modal, select emoji ...)
        // Instead we are directly firing an emoji to make the test easier to write
        jest.spyOn(EmojiButton, "EmojiButton").mockImplementation(
            ({ addEmoji }: { addEmoji: (emoji: string) => void }) => {
                return (
                    <button aria-label="Emoji" type="button" onClick={() => addEmoji("🦫")}>
                        Emoji
                    </button>
                );
            },
        );
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={defaultRoomContext}>
                    <EditWysiwygComposer editorStateTransfer={editorStateTransfer} />
                    <Emoji menuPosition={{ chevronFace: ChevronFace.Top }} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
        // Same behavior as in RoomView.tsx
        // RoomView is re-dispatching the composer messages.
        // It adds the composerType fields where the value refers if the composer is in editing or not
        // The listeners in the RTE ignore the message if the composerType is missing in the payload
        const dispatcherRef = dis.register((payload: ActionPayload) => {
            dis.dispatch<ComposerInsertPayload>({
                ...(payload as ComposerInsertPayload),
                composerType: ComposerType.Edit,
            });
        });

        screen.getByLabelText("Emoji").click();

        // Then
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/🦫/));
        dis.unregister(dispatcherRef);
    });

    describe("Keyboard navigation", () => {
        const setup = async (
            editorState = editorStateTransfer,
            client = createTestClient(),
            roomContext = defaultRoomContext,
        ) => {
            const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");
            customRender(false, editorState, client, roomContext);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
            return { textbox: screen.getByRole("textbox"), spyDispatcher };
        };

        beforeEach(() => {
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(mockEvent);
        });

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
                const { textbox, spyDispatcher } = await setup();
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
                expect(spyDispatcher).toBeCalledTimes(0);
            });

            it("Should not moving when the content has changed", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
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
                expect(spyDispatcher).toBeCalledTimes(0);
            });

            it("Should moving up", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
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
                    expect(spyDispatcher).toBeCalledWith({
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
                expect(spyDispatcher).toBeCalledWith({
                    action: Action.EditEvent,
                    event: mockEvent,
                    timelineRenderingType: defaultRoomContext.timelineRenderingType,
                });
            });
        });

        describe("Moving down", () => {
            it("Should not moving when caret is not at the end of the text", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
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
                expect(spyDispatcher).toBeCalledTimes(0);
            });

            it("Should not moving when the content has changed", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
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
                expect(spyDispatcher).toBeCalledTimes(0);
            });

            it("Should moving down", async () => {
                // When
                const { textbox, spyDispatcher } = await setup();
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
                    expect(spyDispatcher).toBeCalledWith({
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
                expect(spyDispatcher).toBeCalledWith({
                    action: Action.EditEvent,
                    event: mockEvent,
                    timelineRenderingType: defaultRoomContext.timelineRenderingType,
                });
            });

            it("Should close editing", async () => {
                // When
                jest.spyOn(EventUtils, "findEditableEvent").mockReturnValue(undefined);
                const { textbox, spyDispatcher } = await setup();
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
                    expect(spyDispatcher).toBeCalledWith({
                        action: Action.EditEvent,
                        event: null,
                        timelineRenderingType: defaultRoomContext.timelineRenderingType,
                    }),
                );
            });
        });
    });
});
