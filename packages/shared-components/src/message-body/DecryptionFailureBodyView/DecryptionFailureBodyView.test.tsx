/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mkMatrixEvent, mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";

import { DecryptionFailureBodyView } from "./DecryptionFailureBodyView";
import { MockViewModel } from "../../viewmodel";
import { LocalDeviceVerificationStateContext } from "../../utils/LocalDeviceVerificationStateContext";

describe("DecryptionFailureBodyView", () => {
    function customRender(event: MatrixEvent, localDeviceVerified: boolean = false): ReturnType<typeof render> {
        return render(
            <LocalDeviceVerificationStateContext.Provider value={localDeviceVerified}>
                <DecryptionFailureBodyView vm={new MockViewModel({ mxEvent: event })} />
            </LocalDeviceVerificationStateContext.Provider>,
        );
    }

    it(`Should display "Unable to decrypt message"`, () => {
        // When
        const event = mkMatrixEvent({
            type: "m.room.message",
            roomId: "myfakeroom",
            sender: "myfakeuser",
            content: {
                msgtype: "m.bad.encrypted",
            },
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

    it("should handle messages from users who change identities after verification", async () => {
        // When
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
            msg: "User previously verified",
            roomId: "fakeroom",
            sender: "fakesender",
        });
        const { container } = customRender(event);

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should handle messages from unverified devices", async () => {
        // When
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.UNSIGNED_SENDER_DEVICE,
            msg: "Unsigned device",
            roomId: "fakeroom",
            sender: "fakesender",
        });
        const { container } = customRender(event);

        // Then
        expect(container).toHaveTextContent("Sent from an insecure device");
    });
});
