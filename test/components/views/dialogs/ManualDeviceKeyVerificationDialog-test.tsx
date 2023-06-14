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
import { render, screen } from "@testing-library/react";
import { Device } from "matrix-js-sdk/src/models/device";
import { MatrixClient } from "matrix-js-sdk/src/client";

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
