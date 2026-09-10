/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import { flushPromises, mkEvent } from "test-utils";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { EditWysiwygComposer } from ".";
import EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { Emoji } from "./components/Emoji";
import { ChevronFace } from "../../../structures/ContextMenu";
import { type ComposerInsertPayload, ComposerType } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { type ActionPayload } from "../../../../dispatcher/payloads";
import * as EmojiButton from "../EmojiButton";
import { createMocks } from "./__mocks__";
import { ScopedRoomContextProvider } from "../../../../contexts/ScopedRoomContext.tsx";
import { RoomUploadContextProvider } from "../../../../viewmodels/room/RoomUploadViewModel.tsx";

beforeAll(initOnce, 10000);

describe("EditWysiwygComposer", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    const { editorStateTransfer, defaultRoomContext, mockClient, mockEvent } = createMocks();

    const customRender = (
        disabled = false,
        _editorStateTransfer = editorStateTransfer,
        client = mockClient,
        roomContext = defaultRoomContext,
    ) => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...roomContext}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer disabled={disabled} editorStateTransfer={_editorStateTransfer} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    };

    it("Should not render the component when not ready", async () => {
        // When
        const { rerender } = customRender(false);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"), {
            timeout: 2000,
        });

        rerender(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext} room={undefined}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer disabled={false} editorStateTransfer={editorStateTransfer} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
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
        let spyDispatcher: MockInstance<(payload: ActionPayload, sync?: boolean) => void>;

        const blankMockEvent = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: { msgtype: "m.text", body: "" },
            event: true,
        });
        const blankEditorStateTransfer = new EditorStateTransfer(blankMockEvent);

        beforeEach(async () => {
            spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch");
            customRender(false, blankEditorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            spyDispatcher.mockRestore();
        });

        it("Should cancel edit on cancel button click", async () => {
            // When
            screen.getByText("Cancel").click();

            // Then
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: Action.EditEvent,
                event: null,
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
            expect(spyDispatcher).toHaveBeenCalledWith({
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
                "body": `* foo bar`,
                "format": "org.matrix.custom.html",
                "formatted_body": `* foo bar`,
                "m.new_content": {
                    body: "foo bar",
                    format: "org.matrix.custom.html",
                    formatted_body: "foo bar",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: blankMockEvent.getId(),
                    rel_type: "m.replace",
                },
                "msgtype": "m.text",
            };
            await waitFor(() =>
                expect(mockClient.sendMessage).toHaveBeenCalledWith(blankMockEvent.getRoomId(), null, expectedContent),
            );

            expect(spyDispatcher).toHaveBeenCalledWith({ action: "message_sent" });
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
        await flushPromises();

        // Then we don't get it because we are disabled
        expect(screen.getByRole("textbox")).not.toHaveFocus();
    });

    it("Should add emoji", async () => {
        // When

        // We are not testing here the emoji button (open modal, select emoji ...)
        // Instead we are directly firing an emoji to make the test easier to write
        vi.spyOn(EmojiButton, "EmojiButton").mockImplementation(
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
                <ScopedRoomContextProvider {...defaultRoomContext}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer editorStateTransfer={editorStateTransfer} />
                    </RoomUploadContextProvider>
                    <Emoji menuPosition={{ chevronFace: ChevronFace.Top }} />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
        // Same behavior as in RoomView.tsx
        // RoomView is re-dispatching the composer messages.
        // It adds the composerType fields where the value refers if the composer is in editing or not
        // The listeners in the RTE ignore the message if the composerType is missing in the payload
        const dispatcherRef = defaultDispatcher.register((payload: ActionPayload) => {
            const insertPayload = payload as ComposerInsertPayload;
            defaultDispatcher.dispatch<ComposerInsertPayload>({
                ...insertPayload,
                timelineRenderingType: insertPayload.timelineRenderingType!,
                composerType: ComposerType.Edit,
            });
        });

        screen.getByLabelText("Emoji").click();

        // Then
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/🦫/));
        defaultDispatcher.unregister(dispatcherRef);
    });
});
