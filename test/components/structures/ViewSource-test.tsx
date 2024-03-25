/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { render } from "@testing-library/react";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import ViewSource from "../../../src/components/structures/ViewSource";
import { mkEvent, stubClient, mkMessage } from "../../test-utils/test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

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
