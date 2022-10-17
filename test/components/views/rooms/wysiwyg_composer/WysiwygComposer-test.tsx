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
import { act, render, screen, waitFor } from "@testing-library/react";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { WysiwygComposer } from "../../../../../src/components/views/rooms/wysiwyg_composer/WysiwygComposer";
import { createTestClient, mkEvent, mkStubRoom } from "../../../../test-utils";

// The wysiwyg fetch wasm bytes and a specific workaround is needed to make it works in a node (jest) environnement
// See https://github.com/matrix-org/matrix-wysiwyg/blob/main/platforms/web/test.setup.ts
jest.mock("@matrix-org/matrix-wysiwyg", () => ({
    useWysiwyg: () => {
        return { ref: { current: null }, content: '<b>html</b>', isWysiwygReady: true, wysiwyg: { clear: () => void 0 },
            formattingStates: { bold: 'enabled', italic: 'enabled', underline: 'enabled', strikeThrough: 'enabled' } };
    },
}));

describe('WysiwygComposer', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    const permalinkCreator = jest.fn() as any;
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

    const defaultRoomContext: IRoomState = {
        room: mockRoom,
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canSendMessages: false,
        canSendVoiceBroadcasts: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEvents: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
        canSelfRedact: false,
        resizing: false,
        narrow: false,
        activeCall: null,
    };

    let sendMessage: () => void;
    const customRender = (onChange = (_content: string) => void 0, disabled = false) => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={defaultRoomContext}>
                    <WysiwygComposer onChange={onChange} permalinkCreator={permalinkCreator} disabled={disabled}>
                        { (_sendMessage) => {
                            sendMessage = _sendMessage;
                        } }</WysiwygComposer>
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    it('Should have contentEditable at false when disabled', () => {
        // When
        customRender(null, true);

        // Then
        expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "false");
    });

    it('Should call onChange handler', (done) => {
        const html = '<b>html</b>';
        customRender((content) => {
            expect(content).toBe((html));
            done();
        });
    //    act(() => callOnChange(html));
    });

    it('Should send message, call clear and focus the textbox', async () => {
        // When
        const html = '<b>html</b>';
        await new Promise((resolve) => {
            customRender(() => resolve(null));
        });
        act(() => sendMessage());

        // Then
        const expectedContent = {
            "body": html,
            "format": "org.matrix.custom.html",
            "formatted_body": html,
            "msgtype": "m.text",
        };
        expect(mockClient.sendMessage).toBeCalledWith('myfakeroom', null, expectedContent);
        expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('Should focus when receiving an Action.FocusSendMessageComposer action', async () => {
        // Given we don't have focus
        customRender(() => {}, false);
        expect(screen.getByRole('textbox')).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.FocusSendMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
    });

    it('Should focus when receiving a reply_to_event action', async () => {
        // Given we don't have focus
        customRender(() => {}, false);
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
        customRender(() => {}, true);
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

