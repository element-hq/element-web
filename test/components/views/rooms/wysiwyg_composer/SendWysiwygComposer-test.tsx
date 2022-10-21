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
import { render, screen, waitFor } from "@testing-library/react";
import { WysiwygProps } from "@matrix-org/matrix-wysiwyg";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../src/contexts/RoomContext";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import { createTestClient, getRoomContext, mkEvent, mkStubRoom } from "../../../../test-utils";
import { SendWysiwygComposer } from "../../../../../src/components/views/rooms/wysiwyg_composer";

const mockClear = jest.fn();

// The wysiwyg fetch wasm bytes and a specific workaround is needed to make it works in a node (jest) environnement
// See https://github.com/matrix-org/matrix-wysiwyg/blob/main/platforms/web/test.setup.ts
jest.mock("@matrix-org/matrix-wysiwyg", () => ({
    useWysiwyg: (props: WysiwygProps) => {
        return {
            ref: { current: null },
            content: '<b>html</b>',
            isWysiwygReady: true,
            wysiwyg: { clear: mockClear },
            formattingStates: {
                bold: 'enabled',
                italic: 'enabled',
                underline: 'enabled',
                strikeThrough: 'enabled',
            },
        };
    },
}));

describe('SendWysiwygComposer', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    const mockClient = createTestClient();
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: 'myfakeroom',
        user: 'myfakeuser',
        content: { "msgtype": "m.text", "body": "Replying to this" },
        event: true,
    });
    const mockRoom = mkStubRoom('myfakeroom', 'myfakeroom', mockClient) as any;
    mockRoom.findEventById = jest.fn(eventId => {
        return eventId === mockEvent.getId() ? mockEvent : null;
    });

    const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {});

    const customRender = (onChange = (_content: string) => void 0, onSend = () => void 0, disabled = false) => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={defaultRoomContext}>
                    <SendWysiwygComposer onChange={onChange} onSend={onSend} disabled={disabled} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    it('Should focus when receiving an Action.FocusSendMessageComposer action', async () => {
        // Given we don't have focus
        customRender(jest.fn(), jest.fn());
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.FocusSendMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    });

    it('Should focus and clear when receiving an Action.ClearAndFocusSendMessageComposer', async () => {
        // Given we don't have focus
        customRender(jest.fn(), jest.fn());
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.ClearAndFocusSendMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
        expect(mockClear).toBeCalledTimes(1);
    });

    it('Should focus when receiving a reply_to_event action', async () => {
        // Given we don't have focus
        customRender(jest.fn(), jest.fn());
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: "reply_to_event",
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    });

    it('Should not focus when disabled', async () => {
        // Given we don't have focus and we are disabled
        customRender(jest.fn(), jest.fn(), true);
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send an action that would cause us to get focus
        defaultDispatcher.dispatch({
            action: Action.FocusSendMessageComposer,
            context: null,
        });
        // (Send a second event to exercise the clearTimeout logic)
        defaultDispatcher.dispatch({
            action: Action.FocusSendMessageComposer,
            context: null,
        });

        // Wait for event dispatch to happen
        await new Promise((r) => setTimeout(r, 200));

        // Then we don't get it because we are disabled
        expect(screen.getByRole('textbox')).not.toHaveFocus();
    });
});

