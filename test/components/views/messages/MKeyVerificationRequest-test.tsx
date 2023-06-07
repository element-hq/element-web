/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, within } from "@testing-library/react";
import { EventEmitter } from "events";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    Phase as VerificationPhase,
    VerificationRequest,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";
import MKeyVerificationRequest from "../../../../src/components/views/messages/MKeyVerificationRequest";

describe("MKeyVerificationRequest", () => {
    const userId = "@user:server";
    const getMockVerificationRequest = (props: Partial<VerificationRequest>) => {
        const res = new EventEmitter();
        Object.assign(res, {
            phase: VerificationPhase.Requested,
            canAccept: false,
            initiatedByMe: true,
            ...props,
        });
        return res as unknown as VerificationRequest;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            getRoom: jest.fn(),
        });
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("should not render if the request is absent", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("should not render if the request is unsent", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Unsent,
        });
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("should render appropriately when the request was sent", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        event.verificationRequest = getMockVerificationRequest({});
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toHaveTextContent("You sent a verification request");
    });

    it("should render appropriately when the request was initiated by me and has been accepted", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Ready,
            otherUserId: "@other:user",
        });
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toHaveTextContent("You sent a verification request");
        expect(within(container).getByRole("button")).toHaveTextContent("@other:user accepted");
    });

    it("should render appropriately when the request was initiated by the other user and has been accepted", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Ready,
            initiatedByMe: false,
            otherUserId: "@other:user",
        });
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toHaveTextContent("@other:user wants to verify");
        expect(within(container).getByRole("button")).toHaveTextContent("You accepted");
    });

    it("should render appropriately when the request was cancelled", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Cancelled,
            cancellingUserId: userId,
        });
        const { container } = render(<MKeyVerificationRequest mxEvent={event} />);
        expect(container).toHaveTextContent("You sent a verification request");
        expect(container).toHaveTextContent("You cancelled");
    });
});
