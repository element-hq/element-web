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

    it("should return the snapshot with converted failure reason", async () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
            verificationState: true,
        });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(
            DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
        );

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(
            DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED,
        );

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.MEGOLM_KEY_WITHHELD });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(
            DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
        );

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(
            DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED,
        );

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.UNKNOWN_ERROR });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.UNKNOWN_SENDER_DEVICE });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        vm.setProps({ decryptionFailureCode: DecryptionFailureCode.UNSIGNED_SENDER_DEVICE });
        expect(vm.getSnapshot().decryptionFailureReason).toBe(DecryptionFailureReason.UNSIGNED_SENDER_DEVICE);
    });

    it("should update snapshot when setProps is called with new className", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: DecryptionFailureCode.UNKNOWN_ERROR,
            extraClassNames: ["custom-class"],
        });
        expect(vm.getSnapshot().extraClassNames).toContain("custom-class");

        vm.setProps({ extraClassNames: ["new-custom-class"] });
        expect(vm.getSnapshot().extraClassNames).toContain("new-custom-class");
    });

    it("should update snapshot when setProps is called with new verificationState", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: DecryptionFailureCode.UNKNOWN_ERROR,
            verificationState: false,
        });
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(false);

        vm.setProps({ verificationState: true });
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(true);
    });
});
