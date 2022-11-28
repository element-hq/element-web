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

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../src/contexts/RoomContext";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import { createTestClient, flushPromises, getRoomContext, mkEvent, mkStubRoom } from "../../../../test-utils";
import { EditWysiwygComposer }
    from "../../../../../src/components/views/rooms/wysiwyg_composer";
import EditorStateTransfer from "../../../../../src/utils/EditorStateTransfer";

describe('EditWysiwygComposer', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    const mockClient = createTestClient();
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: 'myfakeroom',
        user: 'myfakeuser',
        content: {
            "msgtype": "m.text",
            "body": "Replying to this",
            "format": "org.matrix.custom.html",
            "formatted_body": 'Replying <b>to</b> this new content',
        },
        event: true,
    });
    const mockRoom = mkStubRoom('myfakeroom', 'myfakeroom', mockClient) as any;
    mockRoom.findEventById = jest.fn(eventId => {
        return eventId === mockEvent.getId() ? mockEvent : null;
    });

    const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {});

    const editorStateTransfer = new EditorStateTransfer(mockEvent);

    const customRender = (disabled = false, _editorStateTransfer = editorStateTransfer) => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={defaultRoomContext}>
                    <EditWysiwygComposer disabled={disabled} editorStateTransfer={_editorStateTransfer} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    describe('Initialize with content', () => {
        it('Should initialize useWysiwyg with html content', async () => {
            // When
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));

            // Then
            await waitFor(() =>
                expect(screen.getByRole('textbox')).toContainHTML(mockEvent.getContent()['formatted_body']));
        });

        it('Should initialize useWysiwyg with plain text content', async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: 'myfakeroom',
                user: 'myfakeuser',
                content: {
                    "msgtype": "m.text",
                    "body": "Replying to this",
                },
                event: true,
            });
            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));

            // Then
            await waitFor(() =>
                expect(screen.getByRole('textbox')).toContainHTML(mockEvent.getContent()['body']));
        });

        it('Should ignore when formatted_body is not filled', async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: 'myfakeroom',
                user: 'myfakeuser',
                content: {
                    "msgtype": "m.text",
                    "body": "Replying to this",
                    "format": "org.matrix.custom.html",
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);

            // Then
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));
        });

        it('Should strip <mx-reply> tag from initial content', async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: 'myfakeroom',
                user: 'myfakeuser',
                content: {
                    "msgtype": "m.text",
                    "body": "Replying to this",
                    "format": "org.matrix.custom.html",
                    "formatted_body": '<mx-reply>Reply</mx-reply>My content',
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));

            // Then
            await waitFor(() => {
                expect(screen.getByRole('textbox')).not.toContainHTML("<mx-reply>Reply</mx-reply>");
                expect(screen.getByRole('textbox')).toContainHTML("My content");
            });
        });
    });

    describe('Edit and save actions', () => {
        beforeEach(async () => {
            customRender();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));
        });

        const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");
        afterEach(() => {
            spyDispatcher.mockRestore();
        });

        it('Should cancel edit on cancel button click', async () => {
            // When
            screen.getByText('Cancel').click();

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

        it('Should send message on save button click', async () => {
            // When
            const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");
            fireEvent.input(screen.getByRole('textbox'), {
                data: 'foo bar',
                inputType: 'insertText',
            });
            await waitFor(() => expect(screen.getByText('Save')).not.toHaveAttribute('disabled'));

            // Then
            screen.getByText('Save').click();
            const expectedContent = {
                "body": ` * foo bar`,
                "format": "org.matrix.custom.html",
                "formatted_body": ` * foo bar`,
                "m.new_content": {
                    "body": "foo bar",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "foo bar",
                    "msgtype": "m.text",
                },
                "m.relates_to": {
                    "event_id": mockEvent.getId(),
                    "rel_type": "m.replace",
                },
                "msgtype": "m.text",
            };
            expect(mockClient.sendMessage).toBeCalledWith(mockEvent.getRoomId(), null, expectedContent);
            expect(spyDispatcher).toBeCalledWith({ action: 'message_sent' });
        });
    });

    it('Should focus when receiving an Action.FocusEditMessageComposer action', async () => {
        // Given we don't have focus
        customRender();
        screen.getByLabelText('Bold').focus();
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    });

    it('Should not focus when disabled', async () => {
        // Given we don't have focus and we are disabled
        customRender(true);
        screen.getByLabelText('Bold').focus();
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send an action that would cause us to get focus
        act(() => {
            defaultDispatcher.dispatch({
                action: Action.FocusEditMessageComposer,
                context: null,
            });
            // (Send a second event to exercise the clearTimeout logic)
            defaultDispatcher.dispatch({
                action: Action.FocusEditMessageComposer,
                context: null,
            });
        });

        // Wait for event dispatch to happen
        await flushPromises();

        // Then we don't get it because we are disabled
        expect(screen.getByRole('textbox')).not.toHaveFocus();
    });
});

