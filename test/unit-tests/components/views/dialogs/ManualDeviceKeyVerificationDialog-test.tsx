/*
 * Copyright 2024-2025 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { DeviceVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import { stubClient } from "../../../../test-utils";
import { ManualDeviceKeyVerificationDialog } from "../../../../../src/components/views/dialogs/ManualDeviceKeyVerificationDialog";

describe("ManualDeviceKeyVerificationDialog", () => {
    let mockClient: MatrixClient;

    function renderDialog(onFinished: (confirm: boolean) => void) {
        return render(<ManualDeviceKeyVerificationDialog onFinished={onFinished} />);
    }

    beforeEach(() => {
        mockClient = stubClient();
        mockExistingDevices();
    });

    it("should render correctly", () => {
        // When we render a dialog populated with data
        const { dialog } = populateDialog("XYZ", "ABCDEFGH");

        // Then the dialog looks as expected
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("should call onFinished and crossSignDevice if we click Verify", async () => {
        // Given a dialog populated with correct data
        const { dialog, onFinished } = populateDialog("DEVICEID", "FINGERPRINT");

        // When we click Verify session
        dialog.getByRole("button", { name: "Verify session" }).click();

        // Then crossSignDevice is called
        await waitFor(async () => {
            expect(onFinished).toHaveBeenCalledWith(true);
            expect(mockClient.getCrypto()?.crossSignDevice).toHaveBeenCalledWith("DEVICEID");
        });
    });

    it("should not call crossSignDevice if fingerprint is wrong", async () => {
        // Given a dialog populated with incorrect fingerprint
        const { dialog, onFinished } = populateDialog("DEVICEID", "WRONG_FINGERPRINT");

        // When we click Verify session
        act(() => dialog.getByRole("button", { name: "Verify session" }).click());

        // Then crossSignDevice is not called
        await waitFor(async () => {
            expect(onFinished).toHaveBeenCalledWith(true);
            expect(mockClient.getCrypto()?.crossSignDevice).not.toHaveBeenCalled();
        });

        // And an error is displayed
        expect(
            screen.getByText(
                "the supplied fingerprint 'WRONG_FINGERPRINT' does not match the device fingerprint, 'FINGERPRINT'",
                { exact: false },
            ),
        ).toBeVisible();
    });

    it("should not call crossSignDevice if device is already verified", async () => {
        // Given a dialog populated with a correct fingerprint for a verified device
        const { dialog, onFinished } = populateDialog("VERIFIED_DEVICEID", "VERIFIED_FINGERPRINT");

        // When we click Verify session
        act(() => dialog.getByRole("button", { name: "Verify session" }).click());

        // Then crossSignDevice is not called
        await waitFor(async () => {
            expect(onFinished).toHaveBeenCalledWith(true);
            expect(mockClient.getCrypto()?.crossSignDevice).not.toHaveBeenCalled();
        });

        // And an error is displayed
        expect(screen.getByText("Failed to verify 'VERIFIED_DEVICEID': This device is already verified")).toBeVisible();
    });

    it("should not call crossSignDevice if device is already verified and fingerprint is wrong", async () => {
        // Given a dialog populated with an incorrect fingerprint for a verified device
        const { dialog, onFinished } = populateDialog("VERIFIED_DEVICEID", "WRONG_FINGERPRINT");

        // When we click Verify session
        act(() => dialog.getByRole("button", { name: "Verify session" }).click());

        // Then crossSignDevice is not called
        await waitFor(async () => {
            expect(onFinished).toHaveBeenCalledWith(true);
            expect(mockClient.getCrypto()?.crossSignDevice).not.toHaveBeenCalled();
        });

        // And an error is displayed
        expect(
            screen.getByText("The supplied fingerprint does not match, but the device is already verified!", {
                exact: false,
            }),
        ).toBeVisible();
    });

    it("should not call crossSignDevice if device is not found", async () => {
        // Given a dialog populated with incorrect device ID
        const { dialog, onFinished } = populateDialog("WRONG_DEVICE_ID", "FINGERPRINT");

        // When we click Verify session
        act(() => dialog.getByRole("button", { name: "Verify session" }).click());

        // Then crossSignDevice is not called
        await waitFor(async () => {
            expect(onFinished).toHaveBeenCalledWith(true);
            expect(mockClient.getCrypto()?.crossSignDevice).not.toHaveBeenCalled();
        });

        // And an error is displayed
        expect(screen.getByText("device 'WRONG_DEVICE_ID' was not found", { exact: false })).toBeVisible();
    });

    it("should call onFinished but not crossSignDevice if we click Cancel", () => {
        // Given a dialog populated with correct data
        const { dialog, onFinished } = populateDialog("DEVICEID", "FINGERPRINT");

        // When we click cancel
        dialog.getByRole("button", { name: "Cancel" }).click();

        // Then only onFinished is called
        expect(onFinished).toHaveBeenCalledWith(false);
        expect(mockClient.getCrypto()?.crossSignDevice).not.toHaveBeenCalled();
    });

    function unverifiedDevice(): DeviceVerificationStatus {
        return new DeviceVerificationStatus({});
    }

    function verifiedDevice(): DeviceVerificationStatus {
        return new DeviceVerificationStatus({
            signedByOwner: true,
            crossSigningVerified: true,
            tofu: true,
            localVerified: true,
            trustCrossSignedDevices: true,
        });
    }

    /**
     * Set up two devices: DEVICEID, which is unverified, and VERIFIED_DEVICEID, which is verified.
     */
    function mockExistingDevices() {
        mockClient.getCrypto()!.getDeviceVerificationStatus = jest
            .fn()
            .mockImplementation(async (_userId, deviceId) =>
                deviceId === "DEVICEID" ? unverifiedDevice() : verifiedDevice(),
            );

        mockClient.getCrypto()!.getUserDeviceInfo = jest.fn().mockImplementation(async (userIds) => {
            const userDevices = new Map();
            userDevices.set("DEVICEID", { getFingerprint: jest.fn().mockReturnValue("FINGERPRINT") });
            userDevices.set("VERIFIED_DEVICEID", { getFingerprint: jest.fn().mockReturnValue("VERIFIED_FINGERPRINT") });

            const deviceMap = new Map();
            for (const userId of userIds) {
                deviceMap.set(userId, userDevices);
            }
            return deviceMap;
        });
    }

    function populateDialog(deviceId: string, fingerprint: string) {
        const onFinished = jest.fn();
        const dialog = renderDialog(onFinished);
        const deviceIdBox = dialog.getByRole("textbox", { name: "Device ID" });
        const fingerprintBox = dialog.getByRole("textbox", { name: "Fingerprint (session key)" });
        fireEvent.change(deviceIdBox, { target: { value: deviceId } });
        fireEvent.change(fingerprintBox, { target: { value: fingerprint } });
        return { dialog, onFinished };
    }
});
