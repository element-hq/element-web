/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen } from "jest-matrix-react";
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

    it("Renders a warning if user hits Reset", async () => {
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        jest.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // No recovery methods are available, so only the "Can't confirm?" button should be visible
        expect(screen.queryByRole("button", { name: "Can't confirm?" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Use another device" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Use recovery key" })).not.toBeInTheDocument();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears
        expect(screen.getByRole("heading", { name: "You need to reset your identity" })).toBeInTheDocument();
        expect(panel.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("Allows verifying with another device if one is available", async () => {
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        jest.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.hasDevicesToVerifyAgainst = true;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        jest.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // The snapshot should have "Use another device" and "Can't confirm?"
        // buttons, but no "Use recovery key".
        expect(panel.asFragment()).toMatchSnapshot();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your identity?" }),
        ).toBeInTheDocument();
    });

    it("Allows verifying with recovery key if one is available", async () => {
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        jest.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.keyInfo = {} as any;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        jest.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // The snapshot should have "Use recovery key" and "Can't confirm?"
        // buttons, but no "Use another device".
        expect(panel.asFragment()).toMatchSnapshot();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your identity?" }),
        ).toBeInTheDocument();
    });
});
