/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, waitFor } from "jest-matrix-react";
import { MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { mkEvent, stubClient } from "../../../../test-utils";
import Modal from "../../../../../src/Modal";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import type { SettingKey } from "../../../../../src/settings/Settings";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import EditHistoryMessage from "../../../../../src/components/views/messages/EditHistoryMessage";
import ConfirmAndWaitRedactDialog from "../../../../../src/components/views/dialogs/ConfirmAndWaitRedactDialog";
import ViewSource from "../../../../../src/components/structures/ViewSource";
import { EventContentBodyViewModel } from "../../../../../src/viewmodels/message-body/EventContentBodyViewModel";
import { EditHistoryActionBarViewModel } from "../../../../../src/viewmodels/message-body/EditHistoryActionBarViewModel";
import { MessageTimestampViewModel } from "../../../../../src/viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";

describe("EditHistoryMessage", () => {
    const roomId = "!room:example.com";
    let client: ReturnType<typeof stubClient>;
    let developerMode = false;

    const renderComponent = (props: React.ComponentProps<typeof EditHistoryMessage>) => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <EditHistoryMessage {...props} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        client = stubClient();
        developerMode = false;
        jest.spyOn(SettingsStore, "getValue").mockImplementation(((settingName: SettingKey) => {
            switch (settingName) {
                case "developerMode":
                    return developerMode;
                case "showTwelveHourTimestamps":
                case "TextualBody.enableBigEmoji":
                    return false;
                case "Pill.shouldShowPillAvatar":
                    return true;
                default:
                    return null;
            }
        }) as typeof SettingsStore.getValue);
        jest.spyOn(Modal, "createDialog").mockReturnValue({} as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders replaced content, tracks send status, and disposes view models on unmount", async () => {
        const event = mkEvent({
            event: true,
            id: "$event",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            content: {
                "msgtype": MsgType.Text,
                "body": "Original body",
                "m.new_content": {
                    msgtype: MsgType.Text,
                    body: "Edited body",
                },
            },
        });
        const localRedactionEvent = {
            on: jest.fn(),
            off: jest.fn(),
        };
        const getAssociatedStatus = jest.fn().mockReturnValue("sending");
        const eventContentDisposeSpy = jest.spyOn(EventContentBodyViewModel.prototype, "dispose");
        const actionBarDisposeSpy = jest.spyOn(EditHistoryActionBarViewModel.prototype, "dispose");
        const timestampDisposeSpy = jest.spyOn(MessageTimestampViewModel.prototype, "dispose");

        (event as any).localRedactionEvent = jest.fn().mockReturnValue(localRedactionEvent);
        (event as any).getAssociatedStatus = getAssociatedStatus;

        const { container, getByRole, getByText, unmount } = renderComponent({ mxEvent: event });

        expect(getByText("Edited body")).toBeInTheDocument();
        expect(container.querySelector(".mx_EventTile_sending")).not.toBeNull();
        expect(getByRole("button", { name: /remove/i })).toBeInTheDocument();
        expect(localRedactionEvent.on).toHaveBeenCalledWith(MatrixEventEvent.Status, expect.any(Function));

        getAssociatedStatus.mockReturnValue(null);
        const onStatusChanged = localRedactionEvent.on.mock.calls[0][1];
        act(() => {
            onStatusChanged();
        });

        await waitFor(() => expect(container.querySelector(".mx_EventTile_sending")).toBeNull());

        unmount();

        expect(localRedactionEvent.off).toHaveBeenCalledWith(MatrixEventEvent.Status, expect.any(Function));
        expect(eventContentDisposeSpy).toHaveBeenCalled();
        expect(actionBarDisposeSpy).toHaveBeenCalled();
        expect(timestampDisposeSpy).toHaveBeenCalled();
    });

    it("renders diffs for previous edits and formats emotes with the sender name", () => {
        const previousEdit = mkEvent({
            event: true,
            id: "$prev",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            content: {
                msgtype: MsgType.Emote,
                body: "smiles",
            },
        });
        const event = mkEvent({
            event: true,
            id: "$event",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            content: {
                msgtype: MsgType.Emote,
                body: "waves",
            },
        });
        if (event.sender) {
            event.sender.name = "Alice";
        }

        const { container, getByText } = renderComponent({ mxEvent: event, previousEdit });

        expect(getByText("Alice")).toHaveClass("mx_EditHistoryMessage_emoteSender");
        expect(container.querySelector(".mx_EditHistoryMessage_deletion")).not.toBeNull();
        expect(container.querySelector(".mx_EditHistoryMessage_insertion")).not.toBeNull();
        expect(container.querySelector(".mx_EditHistoryMessage_deletion")).not.toBeEmptyDOMElement();
        expect(container.querySelector(".mx_EditHistoryMessage_insertion")).not.toBeEmptyDOMElement();
    });

    it("renders redacted events and opens view source from the action bar", () => {
        developerMode = true;
        const event = mkEvent({
            event: true,
            id: "$event",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            content: {
                msgtype: MsgType.Text,
                body: "Removed",
            },
            unsigned: {
                redacted_because: {
                    event_id: "$redaction",
                    sender: "@moderator:example.com",
                    type: "m.room.redaction",
                    origin_server_ts: Date.UTC(2024, 0, 1, 12, 0, 0),
                    content: {},
                    unsigned: {},
                },
            },
        });
        jest.spyOn(event, "isRedacted").mockReturnValue(true);

        const { container, getByRole, queryByRole } = renderComponent({ mxEvent: event, isBaseEvent: true });

        expect(container.querySelector(".mx_RedactedBody")).not.toBeNull();
        expect(queryByRole("button", { name: /remove/i })).toBeNull();

        fireEvent.click(getByRole("button", { name: /view source/i }));

        expect(Modal.createDialog).toHaveBeenCalledWith(
            ViewSource,
            {
                mxEvent: event,
                ignoreEdits: true,
            },
            "mx_Dialog_viewsource",
        );
    });

    it("opens the redact dialog and uses the client redact callback", async () => {
        const event = mkEvent({
            event: true,
            id: "$event",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            content: {
                msgtype: MsgType.Text,
                body: "Editable",
            },
        });

        const { getByRole } = renderComponent({ mxEvent: event });

        fireEvent.click(getByRole("button", { name: /remove/i }));

        expect(Modal.createDialog).toHaveBeenCalledWith(
            ConfirmAndWaitRedactDialog,
            expect.objectContaining({
                event,
                redact: expect.any(Function),
            }),
            "mx_Dialog_confirmredact",
        );

        const [, dialogProps] = (Modal.createDialog as jest.Mock).mock.calls[0];
        await dialogProps.redact();

        expect(client.redactEvent).toHaveBeenCalledWith(roomId, "$event");
    });

    it("updates content and timestamp view models when props change", () => {
        developerMode = true;
        const firstEventTs = Date.parse("2021-12-17T08:09:00.000Z");
        const secondEventTs = Date.parse("2021-12-17T09:09:00.000Z");
        const firstEvent = mkEvent({
            event: true,
            id: "$first",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            ts: firstEventTs,
            content: {
                msgtype: MsgType.Text,
                body: "First",
            },
        });
        const secondEvent = mkEvent({
            event: true,
            id: "$second",
            room: roomId,
            user: "@alice:example.com",
            type: "m.room.message",
            ts: secondEventTs,
            content: {
                "msgtype": MsgType.Text,
                "body": "Second",
                "m.new_content": {
                    msgtype: MsgType.Text,
                    body: "Second edited",
                },
            },
        });

        const { getByRole, getByText, queryByRole, rerender } = renderComponent({
            mxEvent: firstEvent,
            isTwelveHour: false,
        });

        expect(getByRole("button", { name: /remove/i })).toBeInTheDocument();
        expect(getByText("08:09")).toBeInTheDocument();

        rerender(
            <MatrixClientContext.Provider value={client}>
                <EditHistoryMessage mxEvent={secondEvent} isBaseEvent={true} isTwelveHour={true} />
            </MatrixClientContext.Provider>,
        );

        expect(getByText("Second edited")).toBeInTheDocument();
        expect(getByText("9:09 AM")).toBeInTheDocument();
        expect(queryByRole("button", { name: /remove/i })).toBeNull();
        expect(getByRole("button", { name: /view source/i })).toBeInTheDocument();
    });
});
