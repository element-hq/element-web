/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Device, MatrixClient } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../../test-utils";
import { ManualDeviceKeyVerificationDialog } from "../../../../src/components/views/dialogs/ManualDeviceKeyVerificationDialog";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";

describe("ManualDeviceKeyVerificationDialog", () => {
    let mockClient: MatrixClient;

    function renderDialog(userId: string, device: Device, onLegacyFinished: (confirm: boolean) => void) {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <ManualDeviceKeyVerificationDialog userId={userId} device={device} onFinished={onLegacyFinished} />
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        mockClient = stubClient();
    });

    it("should display the device", () => {
        // When
        const deviceId = "XYZ";
        const device = new Device({
            userId: mockClient.getUserId()!,
            deviceId,
            displayName: "my device",
            algorithms: [],
            keys: new Map([[`ed25519:${deviceId}`, "ABCDEFGH"]]),
        });
        const { container } = renderDialog(mockClient.getUserId()!, device, jest.fn());

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should display the device of another user", () => {
        // When
        const userId = "@alice:example.com";
        const deviceId = "XYZ";
        const device = new Device({
            userId,
            deviceId,
            displayName: "my device",
            algorithms: [],
            keys: new Map([[`ed25519:${deviceId}`, "ABCDEFGH"]]),
        });
        const { container } = renderDialog(userId, device, jest.fn());

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should call onFinished and matrixClient.setDeviceVerified", () => {
        // When
        const deviceId = "XYZ";
        const device = new Device({
            userId: mockClient.getUserId()!,
            deviceId,
            displayName: "my device",
            algorithms: [],
            keys: new Map([[`ed25519:${deviceId}`, "ABCDEFGH"]]),
        });
        const onFinished = jest.fn();
        renderDialog(mockClient.getUserId()!, device, onFinished);

        screen.getByRole("button", { name: "Verify session" }).click();

        // Then
        expect(onFinished).toHaveBeenCalledWith(true);
        expect(mockClient.setDeviceVerified).toHaveBeenCalledWith(mockClient.getUserId(), deviceId, true);
    });

    it("should call onFinished and not matrixClient.setDeviceVerified", () => {
        // When
        const deviceId = "XYZ";
        const device = new Device({
            userId: mockClient.getUserId()!,
            deviceId,
            displayName: "my device",
            algorithms: [],
            keys: new Map([[`ed25519:${deviceId}`, "ABCDEFGH"]]),
        });
        const onFinished = jest.fn();
        renderDialog(mockClient.getUserId()!, device, onFinished);

        screen.getByRole("button", { name: "Cancel" }).click();

        // Then
        expect(onFinished).toHaveBeenCalledWith(false);
        expect(mockClient.setDeviceVerified).not.toHaveBeenCalled();
    });
});
