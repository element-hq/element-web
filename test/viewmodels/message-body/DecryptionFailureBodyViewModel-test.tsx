/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createRef } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { DecryptionFailureBodyViewModel } from "../../../src/viewmodels/message-body/DecryptionFailureBodyViewModel";

describe("DecryptionFailureBodyViewModel", () => {
    const fakeEvent = new MatrixEvent({});
    const fakeRef = createRef<any>();

    it("should return the snapshot", () => {
        const vm = new DecryptionFailureBodyViewModel({ mxEvent: fakeEvent, ref: fakeRef, className: "custom-class" });
        expect(vm.getSnapshot()).toMatchObject({
            mxEvent: fakeEvent,
            ref: fakeRef,
            className: "custom-class",
        });
    });

    it("should update snapshot when setProps is called with new className", () => {
        const vm = new DecryptionFailureBodyViewModel({ mxEvent: fakeEvent, className: "custom-class" });
        expect(vm.getSnapshot().className).toBe("custom-class");

        vm.setProps({ className: "new-custom-class" });
        expect(vm.getSnapshot().className).toBe("new-custom-class");
    });
});
