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

import { Mocked } from "jest-mock";
import * as RustSdkCryptoJs from "@matrix-org/matrix-sdk-crypto-js";

import { CrossSigningIdentity } from "../../../src/rust-crypto/CrossSigningIdentity";
import { OutgoingRequestProcessor } from "../../../src/rust-crypto/OutgoingRequestProcessor";

describe("CrossSigningIdentity", () => {
    describe("bootstrapCrossSigning", () => {
        /** the CrossSigningIdentity implementation under test */
        let crossSigning: CrossSigningIdentity;

        /** a mocked-up OlmMachine which crossSigning is connected to */
        let olmMachine: Mocked<RustSdkCryptoJs.OlmMachine>;

        /** A mock OutgoingRequestProcessor which crossSigning is connected to */
        let outgoingRequestProcessor: Mocked<OutgoingRequestProcessor>;

        beforeEach(async () => {
            await RustSdkCryptoJs.initAsync();

            olmMachine = {
                crossSigningStatus: jest.fn(),
                bootstrapCrossSigning: jest.fn(),
                close: jest.fn(),
            } as unknown as Mocked<RustSdkCryptoJs.OlmMachine>;

            outgoingRequestProcessor = {
                makeOutgoingRequest: jest.fn(),
            } as unknown as Mocked<OutgoingRequestProcessor>;

            crossSigning = new CrossSigningIdentity(olmMachine, outgoingRequestProcessor);
        });

        it("should do nothing if keys are present on-device and in secret storage", async () => {
            olmMachine.crossSigningStatus.mockResolvedValue({
                hasMaster: true,
                hasSelfSigning: true,
                hasUserSigning: true,
            });
            // TODO: secret storage
            await crossSigning.bootstrapCrossSigning({});
            expect(olmMachine.bootstrapCrossSigning).not.toHaveBeenCalled();
            expect(outgoingRequestProcessor.makeOutgoingRequest).not.toHaveBeenCalled();
        });

        it("should call bootstrapCrossSigning if a reset is forced", async () => {
            olmMachine.bootstrapCrossSigning.mockResolvedValue([]);
            await crossSigning.bootstrapCrossSigning({ setupNewCrossSigning: true });
            expect(olmMachine.bootstrapCrossSigning).toHaveBeenCalledWith(true);
        });

        it("should call bootstrapCrossSigning if we need new keys", async () => {
            olmMachine.crossSigningStatus.mockResolvedValue({
                hasMaster: false,
                hasSelfSigning: false,
                hasUserSigning: false,
            });
            olmMachine.bootstrapCrossSigning.mockResolvedValue([]);
            await crossSigning.bootstrapCrossSigning({});
            expect(olmMachine.bootstrapCrossSigning).toHaveBeenCalledWith(true);
        });
    });
});
