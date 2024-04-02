/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { act, render, waitFor } from "@testing-library/react";
import React, { ComponentProps } from "react";
import { User, TypedEventEmitter, Device, MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked, Mocked } from "jest-mock";
import {
    EmojiMapping,
    ShowSasCallbacks,
    VerificationPhase as Phase,
    VerificationRequest,
    VerificationRequestEvent,
    Verifier,
    VerifierEvent,
    VerifierEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api";

import VerificationPanel from "../../../../src/components/views/right_panel/VerificationPanel";
import { flushPromises, stubClient } from "../../../test-utils";

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
            container.getByRole("button", { name: "Start" });
        });

        it("should show a QR code if the other side can scan and QR bytes are calculated", async () => {
            const request = makeMockVerificationRequest({
                phase: Phase.Ready,
            });
            request.generateQRCode.mockResolvedValue(Buffer.from("test", "utf-8"));
            const container = renderComponent({
                request: request,
                layout: "dialog",
            });
            container.getByText("Scan this unique code");
            // it shows a spinner at first; wait for the update which makes it show the QR code
            await waitFor(() => {
                container.getByAltText("QR Code");
            });
        });
    });

    describe("'Ready' phase (regular mode)", () => {
        it("should show a 'Verify by emoji' button", () => {
            const container = renderComponent({
                request: makeMockVerificationRequest({ phase: Phase.Ready }),
            });
            container.getByRole("button", { name: "Verify by emoji" });
        });

        it("should show a QR code if the other side can scan and QR bytes are calculated", async () => {
            const request = makeMockVerificationRequest({
                phase: Phase.Ready,
            });
            request.generateQRCode.mockResolvedValue(Buffer.from("test", "utf-8"));
            const container = renderComponent({
                request: request,
                member: new User("@other:user"),
            });
            container.getByText("Ask @other:user to scan your code:");
            // it shows a spinner at first; wait for the update which makes it show the QR code
            await waitFor(() => {
                container.getByAltText("QR Code");
            });
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
            const { container } = renderComponent({
                request: mockRequest,
                phase: Phase.Started,
            });

            // fire the ShowSas event
            const sasEvent = makeMockSasCallbacks();
            mockVerifier.getShowSasCallbacks.mockReturnValue(sasEvent);
            act(() => {
                mockVerifier.emit(VerifierEvent.ShowSas, sasEvent);
            });

            const emojis = container.getElementsByClassName("mx_VerificationShowSas_emojiSas_block");
            expect(emojis.length).toEqual(7);
            for (const emoji of emojis) {
                expect(emoji).toHaveTextContent("🦄Unicorn");
            }
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

                mocked(client.getCrypto()!).getUserDeviceInfo.mockResolvedValue(
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
        cancel: jest.fn(),
        otherPartySupportsMethod: jest.fn().mockReturnValue(true),
        generateQRCode: jest.fn().mockResolvedValue(undefined),
        ...props,
    });
    return request as unknown as Mocked<VerificationRequest>;
}

function makeMockVerifier(): Mocked<Verifier> {
    const verifier = new TypedEventEmitter<VerifierEvent, VerifierEventHandlerMap>();
    Object.assign(verifier, {
        cancel: jest.fn(),
        verify: jest.fn(),
        getShowSasCallbacks: jest.fn(),
        getReciprocateQrCodeCallbacks: jest.fn(),
    });
    return verifier as unknown as Mocked<Verifier>;
}

function makeMockSasCallbacks(): ShowSasCallbacks {
    const unicorn: EmojiMapping = ["🦄", "unicorn"];
    return {
        sas: {
            emoji: new Array<EmojiMapping>(7).fill(unicorn),
        },
        cancel: jest.fn(),
        confirm: jest.fn(),
        mismatch: jest.fn(),
    };
}
