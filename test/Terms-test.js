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

import * as Matrix from 'matrix-js-sdk';

import { startTermsFlow, Service } from '../src/Terms';
import { stubClient } from './test-utils';
import {MatrixClientPeg} from '../src/MatrixClientPeg';

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

const IM_SERVICE_ONE = new Service(Matrix.SERVICE_TYPES.IM, 'https://imone.test', 'a token token');
const IM_SERVICE_TWO = new Service(Matrix.SERVICE_TYPES.IM, 'https://imtwo.test', 'a token token');

describe('Terms', function() {
    beforeEach(function() {
        stubClient();
    });

    it('should prompt for all terms & services if no account data', async function() {
        MatrixClientPeg.get().getAccountData = jest.fn().mockReturnValue(null);
        MatrixClientPeg.get().getTerms = jest.fn().mockReturnValue({
            policies: {
                "policy_the_first": POLICY_ONE,
            },
        });
        const interactionCallback = jest.fn().mockResolvedValue([]);
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("interaction callback calls", interactionCallback.mock.calls[0]);

        expect(interactionCallback).toBeCalledWith([
            {
                service: IM_SERVICE_ONE,
                policies: {
                    policy_the_first: POLICY_ONE,
                },
            },
        ], []);
    });

    it('should not prompt if all policies are signed in account data', async function() {
        MatrixClientPeg.get().getAccountData = jest.fn().mockReturnValue({
            getContent: jest.fn().mockReturnValue({
                accepted: ["http://example.com/one"],
            }),
        });
        MatrixClientPeg.get().getTerms = jest.fn().mockReturnValue({
            policies: {
                "policy_the_first": POLICY_ONE,
            },
        });
        MatrixClientPeg.get().agreeToTerms = jest.fn();

        const interactionCallback = jest.fn();
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.mock.calls[0]);

        expect(interactionCallback).not.toHaveBeenCalled();
        expect(MatrixClientPeg.get().agreeToTerms).toBeCalledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one"],
        );
    });

    it("should prompt for only terms that aren't already signed", async function() {
        MatrixClientPeg.get().getAccountData = jest.fn().mockReturnValue({
            getContent: jest.fn().mockReturnValue({
                accepted: ["http://example.com/one"],
            }),
        });
        MatrixClientPeg.get().getTerms = jest.fn().mockReturnValue({
            policies: {
                "policy_the_first": POLICY_ONE,
                "policy_the_second": POLICY_TWO,
            },
        });
        MatrixClientPeg.get().agreeToTerms = jest.fn();

        const interactionCallback = jest.fn().mockResolvedValue(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("interactionCallback call", interactionCallback.mock.calls[0]);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.mock.calls[0]);

        expect(interactionCallback).toBeCalledWith([
            {
                service: IM_SERVICE_ONE,
                policies: {
                    policy_the_second: POLICY_TWO,
                },
            },
        ], ["http://example.com/one"]);
        expect(MatrixClientPeg.get().agreeToTerms).toBeCalledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one", "http://example.com/two"],
        );
    });

    it("should prompt for only services with un-agreed policies", async function() {
        MatrixClientPeg.get().getAccountData = jest.fn().mockReturnValue({
            getContent: jest.fn().mockReturnValue({
                accepted: ["http://example.com/one"],
            }),
        });

        MatrixClientPeg.get().getTerms = jest.fn((serviceType, baseUrl, accessToken) => {
            switch (baseUrl) {
                case 'https://imone.test':
                    return {
                        policies: {
                            "policy_the_first": POLICY_ONE,
                        },
                    };
                case 'https://imtwo.test':
                    return {
                        policies: {
                            "policy_the_second": POLICY_TWO,
                        },
                    };
            }
        });

        MatrixClientPeg.get().agreeToTerms = jest.fn();

        const interactionCallback = jest.fn().mockResolvedValue(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow([IM_SERVICE_ONE, IM_SERVICE_TWO], interactionCallback);
        console.log("getTerms call 0", MatrixClientPeg.get().getTerms.mock.calls[0]);
        console.log("getTerms call 1", MatrixClientPeg.get().getTerms.mock.calls[1]);
        console.log("interactionCallback call", interactionCallback.mock.calls[0]);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.mock.calls[0]);

        expect(interactionCallback).toBeCalledWith([
            {
                service: IM_SERVICE_TWO,
                policies: {
                    policy_the_second: POLICY_TWO,
                },
            },
        ], ["http://example.com/one"]);
        expect(MatrixClientPeg.get().agreeToTerms).toBeCalledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one"],
        );
        expect(MatrixClientPeg.get().agreeToTerms).toBeCalledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imtwo.test',
            'a token token',
            ["http://example.com/two"],
        );
    });
});

