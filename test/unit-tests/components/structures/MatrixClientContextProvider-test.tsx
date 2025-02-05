/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render } from "jest-matrix-react";
import React, { useContext } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { CryptoEvent, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientContextProvider } from "../../../../src/components/structures/MatrixClientContextProvider";
import { LocalDeviceVerificationStateContext } from "../../../../src/contexts/LocalDeviceVerificationStateContext";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../test-utils";

describe("MatrixClientContextProvider", () => {
    it("Should expose a matrix client context", () => {
        const mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            getCrypto: () => null,
        });

        let receivedClient: MatrixClient | undefined;
        function ContextReceiver() {
            receivedClient = useContext(MatrixClientContext);
            return <></>;
        }

        render(
            <MatrixClientContextProvider client={mockClient}>
                <ContextReceiver />
            </MatrixClientContextProvider>,
        );

        expect(receivedClient).toBe(mockClient);
    });

    describe("Should expose a verification status context", () => {
        /** The most recent verification status received by our `ContextReceiver` */
        let receivedState: boolean | undefined;

        /** The mock client for use in the tests */
        let mockClient: MatrixClient;

        function ContextReceiver() {
            receivedState = useContext(LocalDeviceVerificationStateContext);
            return <></>;
        }

        function getComponent(mockClient: MatrixClient) {
            return render(
                <MatrixClientContextProvider client={mockClient}>
                    <ContextReceiver />
                </MatrixClientContextProvider>,
            );
        }

        beforeEach(() => {
            receivedState = undefined;
            mockClient = getMockClientWithEventEmitter({
                ...mockClientMethodsUser(),
                ...mockClientMethodsCrypto(),
            });
        });

        it("returns false if device is unverified", async () => {
            mockClient.getCrypto()!.getUserVerificationStatus = jest
                .fn()
                .mockResolvedValue(new UserVerificationStatus(false, false, false));
            getComponent(mockClient);
            expect(receivedState).toBe(false);
        });

        it("returns true if device is verified", async () => {
            mockClient.getCrypto()!.getUserVerificationStatus = jest
                .fn()
                .mockResolvedValue(new UserVerificationStatus(true, false, false));
            getComponent(mockClient);
            await act(() => flushPromises());
            expect(receivedState).toBe(true);
        });

        it("updates when the trust status updates", async () => {
            const getVerificationStatus = jest.fn().mockResolvedValue(new UserVerificationStatus(false, false, false));
            mockClient.getCrypto()!.getUserVerificationStatus = getVerificationStatus;
            getComponent(mockClient);

            // starts out false
            await act(() => flushPromises());
            expect(receivedState).toBe(false);

            // Now the state is updated
            const verifiedStatus = new UserVerificationStatus(true, false, false);
            getVerificationStatus.mockResolvedValue(verifiedStatus);
            act(() => {
                mockClient.emit(CryptoEvent.UserTrustStatusChanged, mockClient.getSafeUserId(), verifiedStatus);
            });
            expect(receivedState).toBe(true);
        });
    });
});
