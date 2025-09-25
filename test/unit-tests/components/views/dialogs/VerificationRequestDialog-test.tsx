/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen } from "jest-matrix-react";
import { User } from "matrix-js-sdk/src/matrix";
import {
    type ShowSasCallbacks,
    VerificationPhase,
    type Verifier,
    type VerificationRequest,
    type ShowQrCodeCallbacks,
} from "matrix-js-sdk/src/crypto-api";
import { VerificationMethod } from "matrix-js-sdk/src/types";

import VerificationRequestDialog from "../../../../../src/components/views/dialogs/VerificationRequestDialog";
import { stubClient } from "../../../../test-utils";

describe("VerificationRequestDialog", () => {
    function renderComponent(phase: VerificationPhase, method?: "emoji" | "qr"): ReturnType<typeof render> {
        const member = User.createUser("@alice:example.org", stubClient());
        const request = createRequest(phase, method);

        return render(
            <VerificationRequestDialog onFinished={jest.fn()} member={member} verificationRequest={request} />,
        );
    }

    it("Initially, asks how you would like to verify this device", async () => {
        const dialog = renderComponent(VerificationPhase.Ready);

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByText("Verify this device by completing one of the following:")).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("After we started verification here, says we are waiting for the other device", async () => {
        const dialog = renderComponent(VerificationPhase.Requested);

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();

        expect(
            screen.getByText("To proceed, please accept the verification request on your other device."),
        ).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("When other device accepted emoji, displays emojis and asks for confirmation", async () => {
        const dialog = renderComponent(VerificationPhase.Started, "emoji");

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();

        expect(
            screen.getByText("Confirm the emoji below are displayed on both devices, in the same order:"),
        ).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("After scanning QR, shows confirmation dialog", async () => {
        const dialog = renderComponent(VerificationPhase.Started, "qr");

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Verify by scanning" })).toBeInTheDocument();

        expect(screen.getByText("Almost there! Is your other device showing the same shield?")).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("Shows a successful message if verification finished normally", async () => {
        const dialog = renderComponent(VerificationPhase.Done);

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByText("You've successfully verified your device!")).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("Shows a failure message if verification was cancelled", async () => {
        const dialog = renderComponent(VerificationPhase.Cancelled);

        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Verification cancelled" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "You cancelled verification on your other device. Start verification again from the notification.",
            ),
        ).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("Renders correctly if the request is supplied later via a promise", async () => {
        // Given we supply a promise of a request instead of a request
        const member = User.createUser("@alice:example.org", stubClient());
        const requestPromise = Promise.resolve(createRequest(VerificationPhase.Cancelled));

        // When we render the dialog
        render(
            <VerificationRequestDialog
                onFinished={jest.fn()}
                member={member}
                verificationRequestPromise={requestPromise}
            />,
        );

        // And wait for the component to mount, the promise to resolve and the component state to update
        await act(async () => await new Promise(process.nextTick));

        // Then it renders the resolved information
        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Verification cancelled" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "You cancelled verification on your other device. Start verification again from the notification.",
            ),
        ).toBeInTheDocument();
    });

    it("Renders the later promise request if both immediate and promise are supplied", async () => {
        // Given we supply a promise of a request as well as a request
        const member = User.createUser("@alice:example.org", stubClient());
        const request = createRequest(VerificationPhase.Ready);
        const requestPromise = Promise.resolve(createRequest(VerificationPhase.Cancelled));

        // When we render the dialog
        render(
            <VerificationRequestDialog
                onFinished={jest.fn()}
                member={member}
                verificationRequest={request}
                verificationRequestPromise={requestPromise}
            />,
        );

        // And wait for the component to mount, the promise to resolve and the component state to update
        await act(async () => await new Promise(process.nextTick));

        // Then it renders the information from the request in the promise
        expect(screen.getByRole("heading", { name: "Verify other device" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Verification cancelled" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "You cancelled verification on your other device. Start verification again from the notification.",
            ),
        ).toBeInTheDocument();
    });
});

function createRequest(phase: VerificationPhase, method?: "emoji" | "qr"): VerificationRequest {
    let verifier = undefined;
    let chosenMethod = undefined;

    switch (method) {
        case "emoji":
            chosenMethod = VerificationMethod.Sas;
            verifier = createEmojiVerifier();
            break;
        case "qr":
            chosenMethod = VerificationMethod.Reciprocate;
            verifier = createQrVerifier();
            break;
    }

    return {
        phase: jest.fn().mockReturnValue(phase),

        // VerificationRequest is an emitter - ignore any events that are emitted.
        on: jest.fn(),
        off: jest.fn(),

        // These tests (so far) only check for when we are initiating a verificiation of our own device.
        isSelfVerification: jest.fn().mockReturnValue(true),
        initiatedByMe: jest.fn().mockReturnValue(true),

        // Always returning true means we can support QR code and emoji verification.
        otherPartySupportsMethod: jest.fn().mockReturnValue(true),

        // If we asked for emoji, these are populated.
        verifier,
        chosenMethod,
    } as unknown as VerificationRequest;
}

function createEmojiVerifier(): Verifier {
    const showSasCallbacks = {
        sas: {
            emoji: [
                // Example set of emoji to display.
                ["🐶", "Dog"],
                ["🐱", "Cat"],
            ],
        },
    } as ShowSasCallbacks;

    return {
        getShowSasCallbacks: jest.fn().mockReturnValue(showSasCallbacks),
        getReciprocateQrCodeCallbacks: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        verify: jest.fn(),
    } as unknown as Verifier;
}

function createQrVerifier(): Verifier {
    const reciprocateQrCodeCallbacks = {
        confirm: jest.fn(),
        cancel: jest.fn(),
    } as ShowQrCodeCallbacks;

    return {
        getShowSasCallbacks: jest.fn(),
        getReciprocateQrCodeCallbacks: jest.fn().mockReturnValue(reciprocateQrCodeCallbacks),
        on: jest.fn(),
        off: jest.fn(),
        verify: jest.fn(),
    } as unknown as Verifier;
}
