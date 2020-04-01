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

import ScalarAuthClient from '../src/ScalarAuthClient';
import {MatrixClientPeg} from '../src/MatrixClientPeg';
import { stubClient } from './test-utils';

describe('ScalarAuthClient', function() {
    beforeEach(function() {
        window.localStorage.getItem = jest.fn((arg) => {
            if (arg === "mx_scalar_token") return "brokentoken";
        });
        stubClient();
    });

    it('should request a new token if the old one fails', async function() {
        const sac = new ScalarAuthClient();

        sac._getAccountName = jest.fn((arg) => {
            switch (arg) {
                case "brokentoken":
                    return Promise.reject({
                        message: "Invalid token",
                    });
                case "wokentoken":
                    return Promise.resolve(MatrixClientPeg.get().getUserId());
            }
        });

        MatrixClientPeg.get().getOpenIdToken = jest.fn().mockResolvedValue('this is your openid token');

        sac.exchangeForScalarToken = jest.fn((arg) => {
            if (arg === "this is your openid token") return Promise.resolve("wokentoken");
        });

        await sac.connect();

        expect(sac.exchangeForScalarToken).toBeCalledWith('this is your openid token');
        expect(sac.scalarToken).toEqual('wokentoken');
    });
});
