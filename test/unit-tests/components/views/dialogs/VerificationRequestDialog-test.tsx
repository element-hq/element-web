/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen } from "jest-matrix-react";
import { TypedEventEmitter, User } from "matrix-js-sdk/src/matrix";
import {
    type ShowSasCallbacks,
    VerificationPhase,
    type Verifier,
    type VerificationRequest,
    type ShowQrCodeCallbacks,
    VerificationRequestEvent,
    type VerificationRequestEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api";
import { VerificationMethod } from "matrix-js-sdk/src/types";

import { stubClient } from "../../../../test-utils";
import VerificationRequestDialog from "../../../../../src/components/views/dialogs/VerificationRequestDialog";

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

        expect(screen.getByRole("heading", { name: "Choose how to verify" })).toBeInTheDocument();
        expect(screen.getByText("Verify by completing one of the following:")).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("After we started verification here, says we are waiting for the other device", async () => {
        const dialog = renderComponent(VerificationPhase.Requested);

        expect(screen.getByRole("heading", { name: "Start verification on the other device" })).toBeInTheDocument();
        expect(screen.getByText("Once accepted you'll be able to continue with the verification.")).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("When other device accepted emoji, displays emojis and asks for confirmation", async () => {
        const dialog = renderComponent(VerificationPhase.Started, "emoji");

        expect(screen.getByRole("heading", { name: "Compare emojis" })).toBeInTheDocument();

        expect(
            screen.getByText("Confirm that the emojis below match those shown on your other device."),
        ).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("After scanning QR, shows confirmation dialog", async () => {
        const dialog = renderComponent(VerificationPhase.Started, "qr");

        expect(
            screen.getByRole("heading", {
                name: "Confirm that you see a green shield on your other device",
            }),
        ).toBeInTheDocument();

        // We used to have a subheading here: confirm it is not present.
        expect(screen.queryByRole("heading", { name: "Verify by scanning" })).not.toBeInTheDocument();

        expect(screen.getByText("Check again on your other device to finish verification.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Yes, I see a green shield" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "No, I don't see a green shield" })).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("Shows a successful message if verification finished normally", async () => {
        const dialog = renderComponent(VerificationPhase.Done);

        expect(screen.getByRole("heading", { name: "Device verified" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "Now you can read or send messages securely, and anyone you chat with can also trust this device.",
            ),
        ).toBeInTheDocument();

        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("Shows a failure message if verification was cancelled", async () => {
        const dialog = renderComponent(VerificationPhase.Cancelled);

        expect(screen.getByRole("heading", { name: "Verification failed" })).toBeInTheDocument();

        // We used to have a sub-heading here: confirm is it not present.
        expect(screen.queryByRole("heading", { name: "Verification cancelled" })).not.toBeInTheDocument();

        expect(
            screen.getByText(
                "Either the request timed out, the request was denied, or there was a verification mismatch.",
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
        expect(screen.getByRole("heading", { name: "Verification failed" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "Either the request timed out, the request was denied, or there was a verification mismatch.",
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
        expect(screen.getByRole("heading", { name: "Verification failed" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "Either the request timed out, the request was denied, or there was a verification mismatch.",
            ),
        ).toBeInTheDocument();
    });

    it("Changes the dialog contents when the request changes phase", async () => {
        // Given we rendered the component with a phase of Unsent
        const member = User.createUser("@alice:example.org", stubClient());
        const request = createRequest(VerificationPhase.Unsent);

        render(<VerificationRequestDialog onFinished={jest.fn()} member={member} verificationRequest={request} />);

        // When I cancel the request (which changes phase and emits a Changed event)
        await act(async () => await request.cancel());

        // Then the dialog is updated to reflect that
        expect(screen.getByRole("heading", { name: "Verification failed" })).toBeInTheDocument();

        expect(
            screen.getByText(
                "Either the request timed out, the request was denied, or there was a verification mismatch.",
            ),
        ).toBeInTheDocument();
    });
});

function createRequest(phase: VerificationPhase, method?: "emoji" | "qr"): MockVerificationRequest {
    let verifier = undefined;
    let chosenMethod = null;

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

    return new MockVerificationRequest(phase, verifier, chosenMethod);
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

class MockVerificationRequest
    extends TypedEventEmitter<VerificationRequestEvent, VerificationRequestEventHandlerMap>
    implements VerificationRequest
{
    phase_: VerificationPhase;
    verifier_: Verifier | undefined;
    chosenMethod_: string | null;

    constructor(phase: VerificationPhase, verifier: Verifier | undefined, chosenMethod: string | null) {
        super();
        this.phase_ = phase;
        this.verifier_ = verifier;
        this.chosenMethod_ = chosenMethod;
    }

    get phase(): VerificationPhase {
        return this.phase_;
    }

    get isSelfVerification(): boolean {
        // So far we are only testing verification of our own devices
        return true;
    }

    get initiatedByMe(): boolean {
        // So far we are only testing verification started by this device
        return true;
    }

    otherPartySupportsMethod(): boolean {
        // This makes both emoji and QR verification options appear
        return true;
    }

    get verifier(): Verifier | undefined {
        return this.verifier_;
    }

    get chosenMethod(): string | null {
        return this.chosenMethod_;
    }

    async cancel(): Promise<void> {
        this.phase_ = VerificationPhase.Cancelled;
        this.emit(VerificationRequestEvent.Change);
    }

    get transactionId(): string | undefined {
        return undefined;
    }

    get roomId(): string | undefined {
        return undefined;
    }

    get otherUserId(): string {
        return "otheruser";
    }

    get otherDeviceId(): string | undefined {
        return undefined;
    }

    get pending(): boolean {
        return false;
    }

    get accepting(): boolean {
        return false;
    }

    get declining(): boolean {
        return false;
    }

    get timeout(): number | null {
        return null;
    }

    get methods(): string[] {
        return [];
    }

    async accept(): Promise<void> {}

    startVerification(_method: string): Promise<Verifier> {
        throw new Error("Method not implemented.");
    }

    scanQRCode(_qrCodeData: Uint8ClampedArray): Promise<Verifier> {
        throw new Error("Method not implemented.");
    }

    async generateQRCode(): Promise<Uint8ClampedArray | undefined> {
        return new Uint8ClampedArray();
    }

    get cancellationCode(): string | null {
        return null;
    }

    get cancellingUserId(): string | undefined {
        return "otheruser";
    }
}
