/*
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react";
import { render } from "@testing-library/react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../../test-utils";
import { DecryptionFailureBody } from "../../../../src/components/views/messages/DecryptionFailureBody";

describe("DecryptionFailureBody", () => {
    function customRender(event: MatrixEvent) {
        return render(<DecryptionFailureBody mxEvent={event} />);
    }

    it(`Should display "Unable to decrypt message"`, () => {
        // When
        const event = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: {
                msgtype: "m.bad.encrypted",
            },
            event: true,
        });
        const { container } = customRender(event);

        // Then
        expect(container).toMatchSnapshot();
    });

    it(`Should display "The sender has blocked you from receiving this message"`, () => {
        // When
        const event = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: {
                msgtype: "m.bad.encrypted",
            },
            event: true,
        });
        jest.spyOn(event, "isEncryptedDisabledForUnverifiedDevices", "get").mockReturnValue(true);
        const { container } = customRender(event);

        // Then
        expect(container).toMatchSnapshot();
    });
});
