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
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // No recovery methods are available, so only the "Can't confirm?" button should be visible
        expect(screen.queryByRole("button", { name: "Can't confirm?" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Use another device" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Use recovery key" })).not.toBeInTheDocument();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears
        expect(screen.getByRole("heading", { name: "You need to reset your digital identity" })).toBeInTheDocument();
        expect(panel.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("Allows verifying with another device if one is available", async () => {
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        vi.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.hasDevicesToVerifyAgainst = true;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // The snapshot should have "Use another device" and "Can't confirm?"
        // buttons, but no "Use recovery key".
        expect(panel.asFragment()).toMatchSnapshot();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your digital identity?" }),
        ).toBeInTheDocument();
    });

    it("Allows verifying with recovery key if one is available", async () => {
        // Given a store and a dialog based on it
        const store = new SetupEncryptionStore();
        vi.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.keyInfo = {} as any;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        const panel = await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // The snapshot should have "Use recovery key" and "Can't confirm?"
        // buttons, but no "Use another device".
        expect(panel.asFragment()).toMatchSnapshot();

        // When we hit reset
        await act(async () => panel.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the reset identity dialog appears, and should have a different
        // title from when there were no verification methods available.
        expect(
            screen.getByRole("heading", { name: "Are you sure you want to reset your digital identity?" }),
        ).toBeInTheDocument();
    });

    it("Allows verifying with recovery key when has4SKeys is true but keyInfo is null", async () => {
        // Regression test for #34721: when 4S exists but the cross-signing master key
        // info couldn't be fetched (isStored returned null), the "Use recovery key"
        // button should still be shown based on has4SKeys.
        const store = new SetupEncryptionStore();
        vi.spyOn(store, "fetchKeyInfo").mockImplementation(async () => {
            store.keyInfo = null;
            store.has4SKeys = true;
            store.hasDevicesToVerifyAgainst = false;
            store.phase = Phase.Intro;
            store.emit("update");
        });
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);
        await act(() => render(<CompleteSecurity onFinished={() => {}} />));

        // lostKeys() should be false because has4SKeys means recovery is possible
        expect(store.lostKeys()).toBe(false);
        // "Use recovery key" should be shown because has4SKeys is true
        expect(screen.getByRole("button", { name: "Use recovery key" })).toBeInTheDocument();
        // "Use another device" should NOT be shown
        expect(screen.queryByRole("button", { name: "Use another device" })).not.toBeInTheDocument();
    });
});
