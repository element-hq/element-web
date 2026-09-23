/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { act, render } from "test-utils-rtl";
import React, { type ComponentProps } from "react";
import { User, TypedEventEmitter, Device, type MatrixClient } from "matrix-js-sdk/src/matrix";
import {
    type EmojiMapping,
    type ShowSasCallbacks,
    VerificationPhase as Phase,
    type VerificationRequest,
    type VerificationRequestEvent,
    type Verifier,
    VerifierEvent,
    type VerifierEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api";

import { flushPromises, stubClient } from "test-utils";
import VerificationPanel from "./VerificationPanel";

describe("<VerificationPanel />", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
    });

    describe("'Ready' phase (dialog mode)", () => {
        it("should show a 'Start' button", () => {
            const container = renderComponent({
                request: makeMockVerificationRequest({
                    phase: Phase.Ready,
                }),
                layout: "dialog",
            });
            expect(container.getByRole("button", { name: "Start" })).toBeVisible();
        });

        it("should show a QR code if the other side can scan and QR bytes are calculated", async () => {
            const request = makeMockVerificationRequest({
                phase: Phase.Ready,
            });
            request.generateQRCode.mockResolvedValue(new Uint8ClampedArray(Buffer.from("test", "utf-8")));
            const container = renderComponent({
                request: request,
                layout: "dialog",
            });
            container.getByText("Scan this unique code");
            // it shows a spinner at first; wait for the update which makes it show the QR code
            await expect(container.findByAltText("QR Code")).resolves.toBeVisible();
        });
    });

    describe("'Ready' phase (regular mode)", () => {
        it("should show a 'Verify by emoji' button", () => {
            const container = renderComponent({
                request: makeMockVerificationRequest({ phase: Phase.Ready }),
            });
            expect(container.getByRole("button", { name: "Verify by emoji" })).toBeVisible();
        });

        it("should show a QR code if the other side can scan and QR bytes are calculated", async () => {
            const request = makeMockVerificationRequest({
                phase: Phase.Ready,
            });
            request.generateQRCode.mockResolvedValue(new Uint8ClampedArray(Buffer.from("test", "utf-8")));
            const container = renderComponent({
                request: request,
                member: new User("@other:user"),
            });
            container.getByText("Ask @other:user to scan your code:");
            // it shows a spinner at first; wait for the update which makes it show the QR code
            await expect(container.findByAltText("QR Code")).resolves.toBeVisible();
        });
    });

    describe("'Verify by emoji' flow", () => {
        let mockVerifier: Mocked<Verifier>;
        let mockRequest: Mocked<VerificationRequest>;

        beforeEach(() => {
            mockVerifier = makeMockVerifier();
            mockRequest = makeMockVerificationRequest({
                verifier: mockVerifier as unknown as VerificationRequest["verifier"],
                chosenMethod: "m.sas.v1",
            });
        });

        it("shows a spinner initially", () => {
            const { container } = renderComponent({
                request: mockRequest,
                phase: Phase.Started,
            });
            expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
        });

        it("should show some emojis once keys are exchanged", () => {
            const { getAllByText } = renderComponent({
                request: mockRequest,
                phase: Phase.Started,
            });

            // fire the ShowSas event
            const sasEvent = makeMockSasCallbacks();
            mockVerifier.getShowSasCallbacks.mockReturnValue(sasEvent);
            act(() => {
                mockVerifier.emit(VerifierEvent.ShowSas, sasEvent);
            });

            expect(getAllByText("🦄")).toHaveLength(7);
            expect(getAllByText("Unicorn")).toHaveLength(7);
        });

        describe("'Verify own device' flow", () => {
            beforeEach(() => {
                Object.defineProperty(mockRequest, "isSelfVerification", { get: () => true });
                Object.defineProperty(mockRequest, "otherDeviceId", { get: () => "other_device" });

                const otherDeviceDetails = new Device({
                    algorithms: [],
                    deviceId: "other_device",
                    keys: new Map(),
                    userId: "",
                    displayName: "my other device",
                });

                vi.mocked(client.getCrypto()!).getUserDeviceInfo.mockResolvedValue(
                    new Map([[client.getSafeUserId(), new Map([["other_device", otherDeviceDetails]])]]),
                );
            });

            it("should show 'Waiting for you to verify' after confirming", async () => {
                const rendered = renderComponent({
                    request: mockRequest,
                    phase: Phase.Started,
                });

                // wait for the device to be looked up
                await act(() => flushPromises());

                // fire the ShowSas event
                const sasEvent = makeMockSasCallbacks();
                mockVerifier.getShowSasCallbacks.mockReturnValue(sasEvent);
                act(() => {
                    mockVerifier.emit(VerifierEvent.ShowSas, sasEvent);
                });

                // confirm
                act(() => {
                    rendered.getByRole("button", { name: "They match" }).click();
                });

                expect(rendered.container).toHaveTextContent(
                    "Waiting for you to verify on your other device, my other device (other_device)…",
                );
            });
        });
    });
});

function renderComponent(props: Partial<ComponentProps<typeof VerificationPanel>> & { request: VerificationRequest }) {
    const defaultProps = {
        layout: "",
        member: {} as User,
        onClose: () => {},
        isRoomEncrypted: false,
        inDialog: false,
        phase: props.request.phase,
    };
    return render(<VerificationPanel {...defaultProps} {...props} />);
}

function makeMockVerificationRequest(props: Partial<VerificationRequest> = {}): Mocked<VerificationRequest> {
    const request = new TypedEventEmitter<VerificationRequestEvent, any>();
    Object.assign(request, {
        cancel: vi.fn(),
        otherPartySupportsMethod: vi.fn().mockReturnValue(true),
        generateQRCode: vi.fn().mockResolvedValue(undefined),
        ...props,
    });
    return request as unknown as Mocked<VerificationRequest>;
}

function makeMockVerifier(): Mocked<Verifier> {
    const verifier = new TypedEventEmitter<VerifierEvent, VerifierEventHandlerMap>();
    Object.assign(verifier, {
        cancel: vi.fn(),
        verify: vi.fn(),
        getShowSasCallbacks: vi.fn(),
        getReciprocateQrCodeCallbacks: vi.fn(),
    });
    return verifier as unknown as Mocked<Verifier>;
}

function makeMockSasCallbacks(): ShowSasCallbacks {
    const unicorn: EmojiMapping = ["🦄", "unicorn"];
    return {
        sas: {
            emoji: Array.from<EmojiMapping>({ length: 7 }).map(() => unicorn),
        },
        cancel: vi.fn(),
        confirm: vi.fn(),
        mismatch: vi.fn(),
    };
}
