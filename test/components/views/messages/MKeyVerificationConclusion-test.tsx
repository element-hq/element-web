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
import { render } from "@testing-library/react";
import { EventEmitter } from "events";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { UserTrustLevel } from "matrix-js-sdk/src/crypto/CrossSigning";
import {
    Phase as VerificationPhase,
    VerificationRequest,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import MKeyVerificationConclusion from "../../../../src/components/views/messages/MKeyVerificationConclusion";
import { getMockClientWithEventEmitter } from "../../../test-utils";

const trustworthy = { isCrossSigningVerified: () => true } as unknown as UserTrustLevel;
const untrustworthy = { isCrossSigningVerified: () => false } as unknown as UserTrustLevel;

describe("MKeyVerificationConclusion", () => {
    const userId = "@user:server";
    const mockClient = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
        getUserId: jest.fn().mockReturnValue(userId),
        checkUserTrust: jest.fn(),
    });

    const getMockVerificationRequest = ({
        pending = false,
        phase = VerificationPhase.Unsent,
        otherUserId,
        cancellingUserId,
    }: {
        pending?: boolean;
        phase?: VerificationPhase;
        otherUserId?: string;
        cancellingUserId?: string;
    }) => {
        class MockVerificationRequest extends EventEmitter {
            constructor(
                public readonly pending: boolean,
                public readonly phase: VerificationPhase,
                public readonly otherUserId?: string,
                public readonly cancellingUserId?: string,
            ) {
                super();
            }
        }
        return new MockVerificationRequest(
            pending,
            phase,
            otherUserId,
            cancellingUserId,
        ) as unknown as VerificationRequest;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.checkUserTrust.mockReturnValue(trustworthy);
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("shouldn't render if there's no verificationRequest", () => {
        const event = new MatrixEvent({});
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();
    });

    it("shouldn't render if the verificationRequest is pending", () => {
        const event = new MatrixEvent({});
        event.verificationRequest = getMockVerificationRequest({ pending: true });
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();
    });

    it("shouldn't render if the event type is cancel but the request type isn't", () => {
        const event = new MatrixEvent({ type: EventType.KeyVerificationCancel });
        event.verificationRequest = getMockVerificationRequest({});
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();
    });

    it("shouldn't render if the event type is done but the request type isn't", () => {
        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = getMockVerificationRequest({});
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();
    });

    it("shouldn't render if the user isn't actually trusted", () => {
        mockClient.checkUserTrust.mockReturnValue(untrustworthy);

        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = getMockVerificationRequest({ phase: VerificationPhase.Done });
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();
    });

    it("should rerender appropriately if user trust status changes", () => {
        mockClient.checkUserTrust.mockReturnValue(untrustworthy);

        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Done,
            otherUserId: "@someuser:domain",
        });
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toBeEmpty();

        mockClient.checkUserTrust.mockReturnValue(trustworthy);

        /* Ensure we don't rerender for every trust status change of any user */
        mockClient.emit(
            CryptoEvent.UserTrustStatusChanged,
            "@anotheruser:domain",
            new UserTrustLevel(true, true, true),
        );
        expect(container).toBeEmpty();

        /* But when our user changes, we do rerender */
        mockClient.emit(
            CryptoEvent.UserTrustStatusChanged,
            event.verificationRequest.otherUserId,
            new UserTrustLevel(true, true, true),
        );
        expect(container).not.toBeEmpty();
    });

    it("should render appropriately if we cancelled the verification", () => {
        const event = new MatrixEvent({ type: "m.key.verification.cancel" });
        event.verificationRequest = getMockVerificationRequest({
            phase: VerificationPhase.Cancelled,
            cancellingUserId: userId,
        });
        const { container } = render(<MKeyVerificationConclusion mxEvent={event} />);
        expect(container).toHaveTextContent("You cancelled verifying");
    });
});
