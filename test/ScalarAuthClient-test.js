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

import ScalarAuthClient from '../src/ScalarAuthClient';
import MatrixClientPeg from '../src/MatrixClientPeg';
import { stubClient } from './test-utils';

describe('ScalarAuthClient', function() {
    let clientSandbox;

    beforeEach(function() {
        sinon.stub(window.localStorage, 'getItem').withArgs('mx_scalar_token').returns('brokentoken');
        clientSandbox = stubClient();
    });

    afterEach(function() {
        clientSandbox.restore();
        sinon.restore();
    });

    it('should request a new token if the old one fails', async function() {
        const sac = new ScalarAuthClient();

        sac._getAccountName = sinon.stub();
        sac._getAccountName.withArgs('brokentoken').rejects({
            message: "Invalid token",
        });
        sac._getAccountName.withArgs('wokentoken').resolves(MatrixClientPeg.get().getUserId());

        MatrixClientPeg.get().getOpenIdToken = sinon.stub().resolves('this is your openid token');

        sac.exchangeForScalarToken = sinon.stub().withArgs('this is your openid token').resolves('wokentoken');

        await sac.connect();

        expect(sac.exchangeForScalarToken.calledWith('this is your openid token')).toBeTruthy();
        expect(sac.scalarToken).toEqual('wokentoken');
    });
});
