/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import TestRenderer from 'react-test-renderer';
import sdk from '../../../skinned-sdk';
import {MatrixClientPeg} from '../../../../src/MatrixClientPeg';
import { stubClient } from '../../../test-utils';

const AccessSecretStorageDialog = sdk.getComponent("dialogs.secretstorage.AccessSecretStorageDialog");

describe("AccessSecretStorageDialog", function() {
    it("Closes the dialog if _onRecoveryKeyNext is called with a valid key", (done) => {
        const testInstance = TestRenderer.create(
            <AccessSecretStorageDialog
              checkPrivateKey={(p) => p && p.recoveryKey && p.recoveryKey == "a"}
              onFinished={(v) => {
                  if (v) { done(); }
                }}
            />,
        );
        testInstance.getInstance().setState({
            recoveryKeyValid: true,
            recoveryKey: "a",
        });
        const e = { preventDefault: () => {} };
        testInstance.getInstance()._onRecoveryKeyNext(e);
    });

    it("Considers a valid key to be valid", function() {
        const testInstance = TestRenderer.create(
            <AccessSecretStorageDialog
              checkPrivateKey={() => true}
            />,
        );
        const v = "asfd";
        const e = { target: { value: v } };
        stubClient();
        MatrixClientPeg.get().isValidRecoveryKey = function(k) {
            return k == v;
        };
        testInstance.getInstance()._onRecoveryKeyChange(e);
        const { recoveryKeyValid } = testInstance.getInstance().state;
        expect(recoveryKeyValid).toBe(true);
    });

    it("Notifies the user if they input an invalid recovery key", async function(done) {
        const testInstance = TestRenderer.create(
            <AccessSecretStorageDialog
              checkPrivateKey={async () => false}
            />,
        );
        const e = { target: { value: "a" } };
        stubClient();
        MatrixClientPeg.get().isValidRecoveryKey = () => true;
        testInstance.getInstance()._onRecoveryKeyChange(e);
        await testInstance.getInstance()._onRecoveryKeyNext({ preventDefault: () => {} });
        const { keyMatches } = testInstance.getInstance().state;
        expect(keyMatches).toBe(false);
        const notification = testInstance.root.findByProps({
            className: "mx_AccessSecretStorageDialog_keyStatus",
        });
        expect(notification.props.children).toEqual(
            ["\uD83D\uDC4E ", "Unable to access secret storage. Please verify that you " +
                     "entered the correct recovery key."]);
        done();
    });

    it("Notifies the user if they input an invalid passphrase", async function(done) {
        const testInstance = TestRenderer.create(
            <AccessSecretStorageDialog
              checkPrivateKey={() => false}
              onFinished={() => {}}
              keyInfo={ { passphrase: {
                  salt: 'nonempty',
                  iterations: 2,
              } } }
            />,
        );
        const e = { target: { value: "a" } };
        stubClient();
        MatrixClientPeg.get().isValidRecoveryKey = () => false;
        testInstance.getInstance()._onPassPhraseChange(e);
        await testInstance.getInstance()._onPassPhraseNext({ preventDefault: () => {} });
        const notification = testInstance.root.findByProps({
            className: "mx_AccessSecretStorageDialog_keyStatus",
        });
        expect(notification.props.children).toEqual(
            ["\uD83D\uDC4E ", "Unable to access secret storage. Please verify that you " +
                     "entered the correct passphrase."]);
        done();
    });
});
