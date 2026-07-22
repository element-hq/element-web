/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { screen, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { flushPromises, mkEvent, stubClient } from "../../../../test-utils";
import { createRedactEventDialog } from "../../../../../src/components/views/dialogs/ConfirmRedactDialog";

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
});
