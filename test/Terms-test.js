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

import expect from 'expect';

import sinon from 'sinon';

import * as Matrix from 'matrix-js-sdk';

import { startTermsFlow, Service } from '../src/Terms';
import { stubClient } from './test-utils';
import MatrixClientPeg from '../src/MatrixClientPeg';

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
    let sandbox;

    beforeEach(function() {
        sandbox = stubClient();
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('should prompt for all terms & services if no account data', async function() {
        MatrixClientPeg.get().getAccountData = sinon.stub().returns(null);
        MatrixClientPeg.get().getTerms = sinon.stub().returns({
            policies: {
                "policy_the_first": POLICY_ONE,
            },
        });
        const interactionCallback = sinon.stub().resolves([]);
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("interaction callback calls", interactionCallback.getCall(0));

        expect(interactionCallback.calledWith([
            {
                service: IM_SERVICE_ONE,
                policies: {
                    policy_the_first: POLICY_ONE,
                },
            },
        ])).toBeTruthy();
    });

    it('should not prompt if all policies are signed in account data', async function() {
        MatrixClientPeg.get().getAccountData = sinon.stub().returns({
            getContent: sinon.stub().returns({
                accepted: ["http://example.com/one"],
            }),
        });
        MatrixClientPeg.get().getTerms = sinon.stub().returns({
            policies: {
                "policy_the_first": POLICY_ONE,
            },
        });
        MatrixClientPeg.get().agreeToTerms = sinon.stub();

        const interactionCallback = sinon.spy();
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.getCall(0).args);

        expect(interactionCallback.called).toBeFalsy();
        expect(MatrixClientPeg.get().agreeToTerms.calledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one"],
        )).toBeTruthy();
    });

    it("should prompt for only terms that aren't already signed", async function() {
        MatrixClientPeg.get().getAccountData = sinon.stub().returns({
            getContent: sinon.stub().returns({
                accepted: ["http://example.com/one"],
            }),
        });
        MatrixClientPeg.get().getTerms = sinon.stub().returns({
            policies: {
                "policy_the_first": POLICY_ONE,
                "policy_the_second": POLICY_TWO,
            },
        });
        MatrixClientPeg.get().agreeToTerms = sinon.stub();

        const interactionCallback = sinon.stub().resolves(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow([IM_SERVICE_ONE], interactionCallback);
        console.log("interactionCallback call", interactionCallback.getCall(0).args);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.getCall(0).args);

        expect(interactionCallback.calledWith([
            {
                service: IM_SERVICE_ONE,
                policies: {
                    policy_the_second: POLICY_TWO,
                },
            },
        ])).toBeTruthy();
        expect(MatrixClientPeg.get().agreeToTerms.calledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one", "http://example.com/two"],
        )).toBeTruthy();
    });

    it("should prompt for only services with un-agreed policies", async function() {
        MatrixClientPeg.get().getAccountData = sinon.stub().returns({
            getContent: sinon.stub().returns({
                accepted: ["http://example.com/one"],
            }),
        });

        MatrixClientPeg.get().getTerms = sinon.stub();
        MatrixClientPeg.get().getTerms.callsFake((serviceType, baseUrl, accessToken) => {
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

        MatrixClientPeg.get().agreeToTerms = sinon.stub();

        const interactionCallback = sinon.stub().resolves(["http://example.com/one", "http://example.com/two"]);
        await startTermsFlow([IM_SERVICE_ONE, IM_SERVICE_TWO], interactionCallback);
        console.log("getTerms call 0", MatrixClientPeg.get().getTerms.getCall(0).args);
        console.log("getTerms call 1", MatrixClientPeg.get().getTerms.getCall(1).args);
        console.log("interactionCallback call", interactionCallback.getCall(0).args);
        console.log("agreeToTerms call", MatrixClientPeg.get().agreeToTerms.getCall(0).args);

        expect(interactionCallback.calledWith([
            {
                service: IM_SERVICE_TWO,
                policies: {
                    policy_the_second: POLICY_TWO,
                },
            },
        ])).toBeTruthy();
        expect(MatrixClientPeg.get().agreeToTerms.calledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imone.test',
            'a token token',
            ["http://example.com/one"],
        )).toBeTruthy();
        expect(MatrixClientPeg.get().agreeToTerms.calledWith(
            Matrix.SERVICE_TYPES.IM,
            'https://imtwo.test',
            'a token token',
            ["http://example.com/two"],
        )).toBeTruthy();
    });
});

