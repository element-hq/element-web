/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import ViewSource from "../../../../src/components/structures/ViewSource";
import { mkEvent, stubClient, mkMessage } from "../../../test-utils/test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

describe("ViewSource", () => {
    const ROOM_ID = "!roomId:example.org";
    const SENDER = "@alice:example.org";

    let redactedMessageEvent: MatrixEvent;

    const redactionEvent = mkEvent({
        user: SENDER,
        event: true,
        type: EventType.RoomRedaction,
        content: {},
    });

    beforeEach(() => {
        redactedMessageEvent = new MatrixEvent({
            type: EventType.RoomMessageEncrypted,
            room_id: ROOM_ID,
            sender: SENDER,
            content: {},
            state_key: undefined,
        });
        redactedMessageEvent.makeRedacted(redactionEvent, new Room(ROOM_ID, stubClient(), SENDER));
    });

    beforeEach(stubClient);

    // See https://github.com/vector-im/element-web/issues/24165
    it("doesn't error when viewing redacted encrypted messages", () => {
        // Sanity checks
        expect(redactedMessageEvent.isEncrypted()).toBeTruthy();
        // @ts-ignore clearEvent is private, but it's being used directly <ViewSource />
        expect(redactedMessageEvent.clearEvent).toBe(undefined);

        expect(() => render(<ViewSource mxEvent={redactedMessageEvent} onFinished={() => {}} />)).not.toThrow();
    });

    it("should show edit button if we are the sender and can post an edit", () => {
        const event = mkMessage({
            msg: "Test",
            user: MatrixClientPeg.get()!.getSafeUserId(),
            room: ROOM_ID,
            event: true,
        });
        const { getByRole } = render(<ViewSource mxEvent={event} onFinished={() => {}} />);
        expect(getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });
});
