/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
import { DecryptionFailureReason } from "@element-hq/web-shared-components";

import { DecryptionFailureBodyViewModel } from "../../../src/viewmodels/message-body/DecryptionFailureBodyViewModel";

describe("DecryptionFailureBodyViewModel", () => {
    const fakeEvent = new MatrixEvent({});

    it("should return the snapshot", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: fakeEvent.decryptionFailureReason,
            verificationState: true,
        });
        expect(vm.getSnapshot()).toMatchObject({
            decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT,
            isLocalDeviceVerified: true,
        });
    });

    it("should return the snapshot with extra class names", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: fakeEvent.decryptionFailureReason,
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
        const event = await mkDecryptionFailureMatrixEvent({
            code: DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
            msg: "withheld",
            roomId: "myfakeroom",
            sender: "myfakeuser",
        });

        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: event.decryptionFailureReason,
            verificationState: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            decryptionFailureReason: DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
            isLocalDeviceVerified: true,
            extraClassNames: ["mx_DecryptionFailureBody", "mx_EventTile_content"],
        });
    });

    it("should update snapshot when setProps is called with new className", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: fakeEvent.decryptionFailureReason,
            extraClassNames: ["custom-class"],
        });
        expect(vm.getSnapshot().extraClassNames).toContain("custom-class");

        vm.setProps({ extraClassNames: ["new-custom-class"] });
        expect(vm.getSnapshot().extraClassNames).toContain("new-custom-class");
    });

    it("should update snapshot when setProps is called with new verificationState", () => {
        const vm = new DecryptionFailureBodyViewModel({
            decryptionFailureCode: fakeEvent.decryptionFailureReason,
            verificationState: false,
        });
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(false);

        vm.setProps({ verificationState: true });
        expect(vm.getSnapshot().isLocalDeviceVerified).toBe(true);
    });
});
