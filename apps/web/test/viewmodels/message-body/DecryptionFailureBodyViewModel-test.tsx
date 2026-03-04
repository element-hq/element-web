/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
import { DecryptionFailureReason } from "@element-hq/web-shared-components";

import { DecryptionFailureBodyViewModel } from "../../../src/viewmodels/message-body/DecryptionFailureBodyViewModel";

describe("DecryptionFailureBodyViewModel", () => {
    it("should return the snapshot", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: null,
            verificationState: true,
        });
        expect(vm.getSnapshot()).toMatchObject({
            decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
            isLocalDeviceVerified: true,
        });
    });

    it("should return the snapshot with extra class names", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: null,
            verificationState: true,
            extraClassNames: ["custom-class"],
        });
        expect(vm.getSnapshot()).toMatchObject({
            decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
            isLocalDeviceVerified: true,
            extraClassNames: ["mx_DecryptionFailureBody", "mx_EventTile_content", "custom-class"],
        });
    });

    it.each([
        {
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
            reason: DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
        },
        {
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP,
            reason: DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP,
        },
        {
            code: DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED,
            reason: DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED,
        },
        {
            code: DecryptionFailureCode.MEGOLM_KEY_WITHHELD,
            reason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        },
        {
            code: DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
            reason: DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
        },
        {
            code: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
            reason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        },
        {
            code: DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX,
            reason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        },
        {
            code: DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
            reason: DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
        },
        {
            code: DecryptionFailureCode.UNKNOWN_ERROR,
            reason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        },
        {
            code: DecryptionFailureCode.UNKNOWN_SENDER_DEVICE,
            reason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
        },
        {
            code: DecryptionFailureCode.UNSIGNED_SENDER_DEVICE,
            reason: DecryptionFailureReason.UNSIGNED_SENDER_DEVICE,
        },
    ])("should return the snapshot with code converted to reason (%s)", ({ code, reason }) => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: code,
        });

        expect(vm.getSnapshot().decryptionFailureReason).toBe(reason);
    });

    it("should update snapshot when setProps is called with new verificationState", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: DecryptionFailureCode.UNKNOWN_ERROR,
            verificationState: false,
        });
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(false);

        vm.setVerificationState(true);
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(true);
    });
});
