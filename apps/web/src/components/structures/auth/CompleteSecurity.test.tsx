/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, render, screen } from "test-utils-rtl";
import EventEmitter from "node:events";
import { stubClient } from "test-utils";

import CompleteSecurity from "./CompleteSecurity";
import { Phase, SetupEncryptionStore } from "../../../stores/SetupEncryptionStore";
import SdkConfig from "../../../SdkConfig";

class MockSetupEncryptionStore extends EventEmitter {
    public phase: Phase = Phase.Intro;
    public lostKeys(): boolean {
        return false;
    }

    public start: () => void = vi.fn();
    public stop: () => void = vi.fn();
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
        vi.mocked(client.getCrypto()!.getUserDeviceInfo).mockResolvedValue(userIdToDevices);

        const mockSetupEncryptionStore = new MockSetupEncryptionStore();
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(
            mockSetupEncryptionStore as SetupEncryptionStore,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("Renders with a cancel button by default", () => {
        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.getByRole("button", { name: "Skip verification for now" })).toBeInTheDocument();
    });

    it("Renders with a cancel button if forceVerification false", () => {
        vi.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
            if (key === "forceVerification") {
                return false;
            }
        });

        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.getByRole("button", { name: "Skip verification for now" })).toBeInTheDocument();
    });

    it("Renders without a cancel button if forceVerification true", () => {
        vi.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
            if (key === "force_verification") {
                return true;
            }
        });

        render(<CompleteSecurity onFinished={() => {}} />);

        expect(screen.queryByRole("button", { name: "Skip verification for now" })).not.toBeInTheDocument();
    });

    it("Renders a warning if user hits Reset", async () => {
        // Given there is no recovery key and no other devices
        const store = new SetupEncryptionStore();
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // No recovery methods are available, so their buttons are disabled.
        expect(screen.getByText("Use recovery key")).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByText("Use another device")).toHaveAttribute("aria-disabled", "true");

        // The "Can't confirm?" button is visible and enabled.
        expect(screen.queryByRole("button", { name: "Can't confirm?" })).toBeInTheDocument();

        // When we hit "Can't confirm?"
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears
        expect(screen.getByRole("heading", { name: "You need to reset your digital identity" })).toBeInTheDocument();
        expect(panel.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("Allows verifying with another device if one is available", async () => {
        // Given there is no recovery key but there are other devices
        const store = new SetupEncryptionStore();
        vi.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.hasDevicesToVerifyAgainst = true;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // "Use recovery key" should be disabled
        expect(screen.getByText("Use recovery key")).toHaveAttribute("aria-disabled", "true");

        // But "Use another device" and "Can't confirm?" are visible and enabled.
        expect(screen.queryByRole("button", { name: "Use another device" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Can't confirm?" })).toBeInTheDocument();

        // When we hit "Can't confirm?"
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your digital identity?" }),
        ).toBeInTheDocument();
    });

    it("Allows verifying with recovery key if one is available", async () => {
        // Given there are no other devices but there is a recovery key
        const store = new SetupEncryptionStore();
        vi.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.keyInfo = {} as any;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // "Use another device" should be disabled
        expect(screen.getByText("Use another device")).toHaveAttribute("aria-disabled", "true");

        // But "Use recovery key" and "Can't confirm?" are visible and enabled.
        expect(screen.queryByRole("button", { name: "Use recovery key" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Can't confirm?" })).toBeInTheDocument();

        // When we hit "Can't confirm?"
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your digital identity?" }),
        ).toBeInTheDocument();
    });
});
