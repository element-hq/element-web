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
import { mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";

import { mkEvent } from "../../../test-utils";
import { DecryptionFailureBody } from "../../../../src/components/views/messages/DecryptionFailureBody";
import { LocalDeviceVerificationStateContext } from "../../../../src/contexts/LocalDeviceVerificationStateContext";

describe("DecryptionFailureBody", () => {
    function customRender(event: MatrixEvent, localDeviceVerified: boolean = false) {
        return render(
            <LocalDeviceVerificationStateContext.Provider value={localDeviceVerified}>
                <DecryptionFailureBody mxEvent={event} />
            </LocalDeviceVerificationStateContext.Provider>,
        );
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

    it(`Should display "The sender has blocked you from receiving this message"`, async () => {
        // When
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        });

        const { container } = customRender(event);

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should handle historical messages with no key backup", async () => {
        // When
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP,
            msg: "No backup",
            roomId: "fakeroom",
            sender: "fakesender",
        });
        const { container } = customRender(event);

        // Then
        expect(container).toHaveTextContent("Historical messages are not available on this device");
    });

    it.each([true, false])(
        "should handle historical messages when there is a backup and device verification is %s",
        async (verified) => {
            // When
            const event = await mkDecryptionFailureMatrixEvent({
                code: DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
                msg: "Failure",
                roomId: "fakeroom",
                sender: "fakesender",
            });
            const { container } = customRender(event, verified);

            // Then
            expect(container).toHaveTextContent(
                verified ? "Unable to decrypt" : "You need to verify this device for access to historical messages",
            );
        },
    );

    it("should handle undecryptable pre-join messages", async () => {
        // When
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED,
            msg: "Not joined",
            roomId: "fakeroom",
            sender: "fakesender",
        });
        const { container } = customRender(event);

        // Then
        expect(container).toHaveTextContent("You don't have access to this message");
    });
});
