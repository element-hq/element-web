/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { act, render } from "@testing-library/react";
import React, { useContext } from "react";
import { CryptoEvent, MatrixClient } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { MatrixClientContextProvider } from "../../../src/components/structures/MatrixClientContextProvider";
import { LocalDeviceVerificationStateContext } from "../../../src/contexts/LocalDeviceVerificationStateContext";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../test-utils";

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
