/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { describe, it, expect, afterEach, vi, type MockedObject} from "vitest";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, RenderResult } from "test-utils-rtl";
import { getMockClientWithEventEmitter } from "test-utils";

import { ResetIdentityDialog } from "./ResetIdentityDialog";

describe("ResetIdentityDialog", () => {
    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it("should show harsh warnings if already logged in", async () => {
        // When we are using the "compromised" variant (we chose to reset
        // identity from the settings screen)
        mockClient();
        const dialog = render(
            <ResetIdentityDialog onFinished={vi.fn()} onReset={vi.fn()} variant="compromised" />
        );

        // Then we render with lots of warnings
        expectWarning(dialog, "are_you_sure");
        expectWarning(dialog, "chat_list_kept");
        expectWarning(dialog, "lose_encrypted_history");
        expectWarning(dialog, "identity_reset");
        // TODO: this warning is currently missing
        // expectWarning(dialog, "devices_reconfirmed");
        expectNoWarning(dialog, "only_reset_if");

        // But not the one that is about logging in
        expectNoWarning(dialog, "if_you_dont_have_access");
    });

    it("should show harsh warnings if logging in and other verification methods are available", async () => {
        // When we are using the "confirm" variant (we are logging in and there
        // are other options for verification available)
        mockClient();
        const dialog = render(
            <ResetIdentityDialog onFinished={vi.fn()} onReset={vi.fn()} variant="confirm" />
        );

        // Then we render with lots of warnings
        expectWarning(dialog, "cant_confirm");
        expectWarning(dialog, "if_you_dont_have_access");
        expectWarning(dialog, "chat_list_kept");
        expectWarning(dialog, "lose_encrypted_history");
        expectWarning(dialog, "identity_reset");
        // TODO: this warning is currently missing
        // expectWarning(dialog, "devices_reconfirmed");
        expectWarning(dialog, "only_reset_if");
    });

    it("should show softer warnings if logging in and no other verification methods are available", async () => {
        // When we are using the "no_verification_method" variant (we are
        // logging in and reset is the only viable option)
        mockClient();
        const dialog = render(
            <ResetIdentityDialog onFinished={vi.fn()} onReset={vi.fn()} variant="no_verification_method" />
        );

        // Then we render with lots of warnings
        expectWarning(dialog, "you_need_to_reset");
        expectWarning(dialog, "you_dont_have_access");
        expectWarning(dialog, "chat_list_kept");
        expectWarning(dialog, "lose_encrypted_history");
        expectWarning(dialog, "identity_reset");

        // But we don't show the device reconfirmation warning because there are
        // no other devices.
        // TODO: this warning is currently missing
        // expectNoWarning(dialog, "devices_reconfirmed");

        // And we don't show the alert because there is no other choice
        expectNoWarning(dialog, "only_reset_if");
    });

    it("should show even softer warnings if logging in, with no encrypted chats", async () => {
        // TODO: not implemented yet

        //// When we are using the "no_encrypted_rooms" variant (we are
        //// logging in, reset is the only viable option, and you have no
        //// encrypted chats)
        //mockClient();
        //const dialog = render(
        //    <ResetIdentityDialog onFinished={vi.fn()} onReset={vi.fn()} variant="no_encrypted_rooms" />
        //);

        //// Then we render with lots of warnings
        //expectWarning(dialog, "you_need_to_reset");
        //expectWarning(dialog, "you_dont_have_access");
        //expectWarning(dialog, "dont_have_any_chats");

        //// And we don't show the usual 3 warnings
        //expectNoWarning(dialog, "chat_list_kept");
        //expectNoWarning(dialog, "lose_encrypted_history");
        //expectNoWarning(dialog, "identity_reset");

        //// But we don't show the device reconfirmation warning because there are
        //// no other devices.
        //// TODO: this warning is currently missing
        //// expectNoWarning(dialog, "devices_reconfirmed");

        //// And we don't show the alert because there is no other choice
        //expectNoWarning(dialog, "only_reset_if");
    });

    it("should call onReset and onFinished when we click Continue", async () => {
        const client = mockClient();

        const onFinished = vi.fn();
        const onReset = vi.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Continue" }).click());

        expect(onReset).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();

        expect(client.getCrypto()?.resetEncryption).toHaveBeenCalled();
    });

    it("should call onFinished when we click Go back", async () => {
        const client = mockClient();

        const onFinished = vi.fn();
        const onReset = vi.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Go back" }).click());

        expect(onFinished).toHaveBeenCalled();

        expect(onReset).not.toHaveBeenCalled();
        expect(client.getCrypto()?.resetEncryption).not.toHaveBeenCalled();
    });

    it("should call onSignOut when we click Sign out", async () => {
        // Given we are in the "no_verification_method" variant
        const client = mockClient();
        const onFinished = vi.fn();
        const onSignOut = vi.fn();
        const onReset = vi.fn();
        const dialog = render(
            <ResetIdentityDialog
                onFinished={onFinished}
                onReset={onReset}
                onSignOut={onSignOut}
                variant="no_verification_method"
            />,
        );

        // Then there is a "Sign out" button instead of "Go back"
        // When we click it
        await act(async () => dialog.getByRole("button", { name: "Sign out" }).click());

        // Then onSignOut was called instead of onFinished
        expect(onSignOut).toHaveBeenCalled();
        expect(onFinished).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
        expect(client.getCrypto()?.resetEncryption).not.toHaveBeenCalled();
    });
});

function mockClient(): MockedObject<MatrixClient> {
    const mockCrypto = {
        resetEncryption: vi.fn().mockResolvedValue(null),
    } as unknown as MockedObject<CryptoApi>;

    return getMockClientWithEventEmitter({
        getCrypto: vi.fn().mockReturnValue(mockCrypto),
    });
}

type WarningType = (
      "are_you_sure"
    | "cant_confirm"
    | "you_need_to_reset"
    | "if_you_dont_have_access"
    | "you_dont_have_access"
    | "chat_list_kept"
    | "lose_encrypted_history"
    | "identity_reset"
    | "devices_reconfirmed"
    | "dont_have_any_chats"
    | "only_reset_if"
);

function warningText(warningType: WarningType): string {
    switch (warningType) {
        case "are_you_sure": return "Are you sure you want to reset your digital identity?";
        case "cant_confirm": return "Can't confirm? You’ll need to reset your digital identity.";
        case "you_need_to_reset": return "You need to reset your digital identity";
        case "if_you_dont_have_access": return "If you don't have access to any other verified devices and you don't have your recovery key, then you'll need to reset your digital identity to continue using the app.";
        case "you_dont_have_access": return "You don't have access to any other verified devices or a recovery key, so you'll need to reset your digital identity to continue using the app.";
        case "chat_list_kept": return "Your account details, contacts, preferences, and chat list will be kept";
        case "lose_encrypted_history": return "You'll lose any encrypted chat history that's stored only on the server";
        case "identity_reset": return "Other users will see that your digital identity has been reset";
        case "devices_reconfirmed": return "Any devices you’re signed in to will need to be reconfirmed";
        case "dont_have_any_chats": return "It looks like you don't have any chats yet. If this is correct, you can safely proceed with resetting your digital identity";
        case "only_reset_if": return "Only reset your digital identity if you don't have access to another verified device and you don't have your recovery key.";
    }
}

function expectWarning(dialog: RenderResult, warningType: WarningType) {
    expect(dialog.getByText(warningText(warningType))).toBeInTheDocument();
}

function expectNoWarning(dialog: RenderResult, warningType: WarningType) {
    expect(dialog.queryByText(warningText(warningType))).not.toBeInTheDocument();
}
