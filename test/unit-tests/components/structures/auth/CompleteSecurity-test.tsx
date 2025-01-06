/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";
import EventEmitter from "events";

import CompleteSecurity from "../../../../../src/components/structures/auth/CompleteSecurity";
import { stubClient } from "../../../../test-utils";
import { Phase, SetupEncryptionStore } from "../../../../../src/stores/SetupEncryptionStore";
import SdkConfig from "../../../../../src/SdkConfig";

class MockSetupEncryptionStore extends EventEmitter {
    public phase: Phase = Phase.Intro;
    public lostKeys(): boolean {
        return false;
    }

    public start: () => void = jest.fn();
    public stop: () => void = jest.fn();
}

describe("CompleteSecurity", () => {
    beforeEach(() => {
        const client = stubClient();
        const deviceIdToDevice = new Map();
        deviceIdToDevice.set("DEVICE_ID", {
            deviceId: "DEVICE_ID",
            userId: "USER_ID",
        });
        const userIdToDevices = new Map();
        userIdToDevices.set("USER_ID", deviceIdToDevice);
        mocked(client.getCrypto()!.getUserDeviceInfo).mockResolvedValue(userIdToDevices);

        const mockSetupEncryptionStore = new MockSetupEncryptionStore();
        jest.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(
            mockSetupEncryptionStore as SetupEncryptionStore,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("Renders with a cancel button by default", () => {
        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.getByRole("button", { name: "Skip verification for now" })).toBeInTheDocument();
    });

    it("Renders with a cancel button if forceVerification false", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
            if (key === "forceVerification") {
                return false;
            }
        });

        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.getByRole("button", { name: "Skip verification for now" })).toBeInTheDocument();
    });

    it("Renders without a cancel button if forceVerification true", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
            if (key === "force_verification") {
                return true;
            }
        });

        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.queryByRole("button", { name: "Skip verification for now" })).not.toBeInTheDocument();
    });
});
