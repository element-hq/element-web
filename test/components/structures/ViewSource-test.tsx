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
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import React from "react";

import ViewSource from "../../../src/components/structures/ViewSource";
import { mkEvent, stubClient } from "../../test-utils/test-utils";

describe("ThreadView", () => {
    const ROOM_ID = "!roomId:example.org";
    const SENDER = "@alice:example.org";

    let messageEvent: MatrixEvent;

    const redactionEvent = mkEvent({
        user: SENDER,
        event: true,
        type: EventType.RoomRedaction,
        content: {},
    });

    beforeEach(() => {
        messageEvent = new MatrixEvent({
            type: EventType.RoomMessageEncrypted,
            room_id: ROOM_ID,
            sender: SENDER,
            content: {},
            state_key: undefined,
        });
        messageEvent.makeRedacted(redactionEvent);
    });

    beforeEach(stubClient);

    // See https://github.com/vector-im/element-web/issues/24165
    it("doesn't error when viewing redacted encrypted messages", () => {
        // Sanity checks
        expect(messageEvent.isEncrypted()).toBeTruthy();
        // @ts-ignore clearEvent is private, but it's being used directly <ViewSource />
        expect(messageEvent.clearEvent).toBe(undefined);

        expect(() => render(<ViewSource mxEvent={messageEvent} onFinished={() => {}} />)).not.toThrow();
    });
});
