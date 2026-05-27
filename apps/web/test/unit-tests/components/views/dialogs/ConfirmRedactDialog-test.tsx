/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { render, screen, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { flushPromises, mkEvent, stubClient } from "../../../../test-utils";
import ConfirmRedactDialog, {
    createRedactEventDialog,
} from "../../../../../src/components/views/dialogs/ConfirmRedactDialog";

describe("ConfirmRedactDialog", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let mxEvent: MatrixEvent;

    const confirmDeleteVoiceBroadcastStartedEvent = async () => {
        act(() => createRedactEventDialog({ mxEvent }));
        // double-flush promises required for the dialog to show up
        await flushPromises();
        await flushPromises();

        await userEvent.click(await screen.findByTestId("dialog-primary-button"));
    };

    beforeEach(() => {
        client = stubClient();
    });

    it("should raise an error for an event without ID", async () => {
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: roomId,
            content: {},
            user: client.getSafeUserId(),
        });
        jest.spyOn(mxEvent, "getId").mockReturnValue(undefined);
        await expect(confirmDeleteVoiceBroadcastStartedEvent()).rejects.toThrow("cannot redact event without ID");
    });

    it("should raise an error for an event without room-ID", async () => {
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: roomId,
            content: {},
            user: client.getSafeUserId(),
        });
        jest.spyOn(mxEvent, "getRoomId").mockReturnValue(undefined);
        await expect(confirmDeleteVoiceBroadcastStartedEvent()).rejects.toThrow(
            `cannot redact event ${mxEvent.getId()} without room ID`,
        );
    });

    describe("rendering", () => {
        it("renders the confirm dialog with danger button class", () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                room: roomId,
                content: {},
                user: client.getSafeUserId(),
            });

            render(<ConfirmRedactDialog event={event} onFinished={jest.fn()} />);

            expect(screen.getByText("Confirm Removal")).toBeInTheDocument();
            expect(screen.getByText("Are you sure you wish to remove (delete) this event?")).toBeInTheDocument();
            expect(screen.getByText("Remove")).toBeInTheDocument();

            const primaryButton = screen.getByTestId("dialog-primary-button");
            expect(primaryButton).toHaveClass("mx_Dialog_primary");
            expect(primaryButton).toHaveClass("danger");
        });

        it("renders extended description for state events", () => {
            const stateEvent = mkEvent({
                event: true,
                type: "m.room.name",
                room: roomId,
                content: {},
                user: client.getSafeUserId(),
                skey: "",
            });

            render(<ConfirmRedactDialog event={stateEvent} onFinished={jest.fn()} />);

            expect(
                screen.getByText(
                    "Are you sure you wish to remove (delete) this event? Note that removing room changes like this could undo the change.",
                ),
            ).toBeInTheDocument();
        });

        it("renders a reason field with placeholder", () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                room: roomId,
                content: {},
                user: client.getSafeUserId(),
            });

            render(<ConfirmRedactDialog event={event} onFinished={jest.fn()} />);

            expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();
        });

        it("calls onFinished with reason when primary button is clicked", async () => {
            const onFinished = jest.fn();
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                room: roomId,
                content: {},
                user: client.getSafeUserId(),
            });

            render(<ConfirmRedactDialog event={event} onFinished={onFinished} />);

            const input = screen.getByRole("textbox");
            await userEvent.type(input, "spam");

            const primaryButton = screen.getByTestId("dialog-primary-button");
            await userEvent.click(primaryButton);

            expect(onFinished).toHaveBeenCalledWith(true, "spam");
        });
    });
});
