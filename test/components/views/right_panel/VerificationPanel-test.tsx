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
import {
    Phase,
    VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";
import { User } from "matrix-js-sdk/src/models/user";
import { Mocked } from "jest-mock";
import {
    EmojiMapping,
    ShowSasCallbacks,
    Verifier,
    VerifierEvent,
    VerifierEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api/verification";

import VerificationPanel from "../../../../src/components/views/right_panel/VerificationPanel";
import { stubClient } from "../../../test-utils";

describe("<VerificationPanel />", () => {
    beforeEach(() => {
        stubClient();
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
            request.getQRCodeBytes.mockReturnValue(Buffer.from("test", "utf-8"));
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
            request.getQRCodeBytes.mockReturnValue(Buffer.from("test", "utf-8"));
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
    });
});

function renderComponent(props: Partial<ComponentProps<typeof VerificationPanel>> & { request: VerificationRequest }) {
    const defaultProps = {
        layout: "",
        member: {} as User,
        onClose: () => undefined,
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
        getQRCodeBytes: jest.fn(),
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
