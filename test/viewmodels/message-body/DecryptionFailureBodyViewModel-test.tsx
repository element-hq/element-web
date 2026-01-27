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

    const decryptionFailureCodes = Object.entries(DecryptionFailureCode)
        .filter(([key, value]) => key === value)
        .map(([key]) => key);

    it.each(decryptionFailureCodes)("should return the snapshot with converted failure reason (%s)", (code) => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: code as DecryptionFailureCode,
        });

        let reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
        switch (code as DecryptionFailureCode) {
            case DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
                reason = DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED;
                break;
            case DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
                reason = DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP;
                break;
            case DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED:
                reason = DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED;
                break;
            case DecryptionFailureCode.MEGOLM_KEY_WITHHELD:
                reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
                break;
            case DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
                reason = DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE;
                break;
            case DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID:
                reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
                break;
            case DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX:
                reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
                break;
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                reason = DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;
                break;
            case DecryptionFailureCode.UNKNOWN_ERROR:
                reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
                break;
            case DecryptionFailureCode.UNKNOWN_SENDER_DEVICE:
                reason = DecryptionFailureReason.UNABLE_TO_DECRYPT;
                break;
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                reason = DecryptionFailureReason.UNSIGNED_SENDER_DEVICE;
                break;
        }

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
