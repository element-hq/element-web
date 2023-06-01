/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent, EventType, SERVICE_TYPES } from "matrix-js-sdk/src/matrix";

import { startTermsFlow, Service } from "../src/Terms";
import { getMockClientWithEventEmitter } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";

const POLICY_ONE = {
    version: "six",
    en: {
        name: "The first policy",
        url: "http://example.com/one",
    },
};

const POLICY_TWO = {
    version: "IX",
    en: {
        name: "The second policy",
        url: "http://example.com/two",
    },
};

const IM_SERVICE_ONE = new Service(SERVICE_TYPES.IM, "https://imone.test", "a token token");
const IM_SERVICE_TWO = new Service(SERVICE_TYPES.IM, "https://imtwo.test", "a token token");

describe("Terms", function () {
    const mockClient = getMockClientWithEventEmitter({
        getAccountData: jest.fn(),
        getTerms: jest.fn(),
        agreeToTerms: jest.fn(),
        setAccountData: jest.fn(),
    });

    beforeEach(function () {
        jest.clearAllMocks();
        mockClient.getAccountData.mockReturnValue(undefined);
        mockClient.getTerms.mockResolvedValue(null);
        mockClient.setAccountData.mockResolvedValue({});
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("should prompt for all terms & services if no account data", async function () {
        mockClient.getAccountData.mockReturnValue(undefined);
        mockClient.getTerms.mockResolvedValue({
            policies: {
                policy_the_first: POLICY_ONE,
            },
        });
        const interactionCallback = jest.fn().mockResolvedValue([]);
        await startTermsFlow(mockClient, [IM_SERVICE_ONE], interactionCallback);

        expect(interactionCallback).toHaveBeenCalledWith(
            [
                {
                    service: IM_SERVICE_ONE,
                    policies: {
                        policy_the_first: POLICY_ONE,
                    },
                },
            ],
            [],
        );
    });

    it("should not prompt if all policies are signed in account data", async function () {
        const directEvent = new MatrixEvent({
            type: EventType.Direct,
            content: {
                accepted: ["http://example.com/one"],
            },
        });
        mockClient.getAccountData.mockReturnValue(directEvent);
        mockClient.getTerms.mockResolvedValue({
            policies: {
                policy_the_first: POLICY_ONE,
            },
        });
        mockClient.agreeToTerms;

        const interactionCallback = jest.fn();
        await startTermsFlow(mockClient, [IM_SERVICE_ONE], interactionCallback);

        expect(interactionCallback).not.toHaveBeenCalled();
        expect(mockClient.agreeToTerms).toHaveBeenCalledWith(SERVICE_TYPES.IM, "https://imone.test", "a token token", [
            "http://example.com/one",
        ]);
    });

    it("should prompt for only terms that aren't already signed", async function () {
        const directEvent = new MatrixEvent({
            type: EventType.Direct,
            content: {
                accepted: ["http://example.com/one"],
            },
        });
        mockClient.getAccountData.mockReturnValue(directEvent);

        mockClient.getTerms.mockResolvedValue({
            policies: {
                policy_the_first: POLICY_ONE,
                policy_the_second: POLICY_TWO,
            },
        });

        const interactionCallback = jest.fn().mockResolvedValue(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow(mockClient, [IM_SERVICE_ONE], interactionCallback);

        expect(interactionCallback).toHaveBeenCalledWith(
            [
                {
                    service: IM_SERVICE_ONE,
                    policies: {
                        policy_the_second: POLICY_TWO,
                    },
                },
            ],
            ["http://example.com/one"],
        );
        expect(mockClient.agreeToTerms).toHaveBeenCalledWith(SERVICE_TYPES.IM, "https://imone.test", "a token token", [
            "http://example.com/one",
            "http://example.com/two",
        ]);
    });

    it("should prompt for only services with un-agreed policies", async function () {
        const directEvent = new MatrixEvent({
            type: EventType.Direct,
            content: {
                accepted: ["http://example.com/one"],
            },
        });
        mockClient.getAccountData.mockReturnValue(directEvent);

        mockClient.getTerms.mockImplementation(async (_serviceTypes: SERVICE_TYPES, baseUrl: string) => {
            switch (baseUrl) {
                case "https://imone.test":
                    return {
                        policies: {
                            policy_the_first: POLICY_ONE,
                        },
                    };
                case "https://imtwo.test":
                    return {
                        policies: {
                            policy_the_second: POLICY_TWO,
                        },
                    };
            }
        });

        const interactionCallback = jest.fn().mockResolvedValue(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow(mockClient, [IM_SERVICE_ONE, IM_SERVICE_TWO], interactionCallback);

        expect(interactionCallback).toHaveBeenCalledWith(
            [
                {
                    service: IM_SERVICE_TWO,
                    policies: {
                        policy_the_second: POLICY_TWO,
                    },
                },
            ],
            ["http://example.com/one"],
        );
        expect(mockClient.agreeToTerms).toHaveBeenCalledWith(SERVICE_TYPES.IM, "https://imone.test", "a token token", [
            "http://example.com/one",
        ]);
        expect(mockClient.agreeToTerms).toHaveBeenCalledWith(SERVICE_TYPES.IM, "https://imtwo.test", "a token token", [
            "http://example.com/two",
        ]);
    });
});
