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
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';

import sdk from '../../../skinned-sdk';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { stubClient } from '../../../test-utils';
import { findById, flushPromises } from '../../../test-utils';

const AccessSecretStorageDialog = sdk.getComponent("dialogs.security.AccessSecretStorageDialog");

describe("AccessSecretStorageDialog", function() {
    it("Closes the dialog if _onRecoveryKeyNext is called with a valid key", async () => {
        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        const wrapper = mount(
            <AccessSecretStorageDialog
                checkPrivateKey={checkPrivateKey}
                onFinished={onFinished}
            />,
        );
        wrapper.setState({
            recoveryKeyValid: true,
            recoveryKey: "a",
        });
        const e = { preventDefault: () => {} };

        wrapper.find('form').simulate('submit', e);

        await flushPromises();

        expect(checkPrivateKey).toHaveBeenCalledWith({ recoveryKey: "a" });
        expect(onFinished).toHaveBeenCalledWith({ recoveryKey: "a" });
    });

    it("Considers a valid key to be valid", async function() {
        const wrapper = mount(
            <AccessSecretStorageDialog
                checkPrivateKey={() => true}
            />,
        );
        stubClient();
        MatrixClientPeg.get().keyBackupKeyFromRecoveryKey = () => 'a raw key';
        MatrixClientPeg.get().checkSecretStorageKey = () => true;

        const v = "asdf";
        const e = { target: { value: v } };
        act(() => {
            findById(wrapper, 'mx_securityKey').find('input').simulate('change', e);
        });
        // force a validation now because it debounces
        await wrapper.instance().validateRecoveryKey();
        const { recoveryKeyValid } = wrapper.instance().state;
        expect(recoveryKeyValid).toBe(true);
    });

    it("Notifies the user if they input an invalid Security Key", async function() {
        const wrapper = mount(
            <AccessSecretStorageDialog
                checkPrivateKey={async () => false}
            />,
        );
        const e = { target: { value: "a" } };
        stubClient();
        MatrixClientPeg.get().keyBackupKeyFromRecoveryKey = () => {
            throw new Error("that's no key");
        };

        act(() => {
            findById(wrapper, 'mx_securityKey').find('input').simulate('change', e);
        });
        // force a validation now because it debounces
        await wrapper.instance().validateRecoveryKey();

        const { recoveryKeyValid, recoveryKeyCorrect } = wrapper.instance().state;
        expect(recoveryKeyValid).toBe(false);
        expect(recoveryKeyCorrect).toBe(false);

        wrapper.setProps({});
        const notification = wrapper.find(".mx_AccessSecretStorageDialog_recoveryKeyFeedback");
        expect(notification.props().children).toEqual("Invalid Security Key");
    });

    it("Notifies the user if they input an invalid passphrase", async function() {
        const wrapper = mount(
            <AccessSecretStorageDialog
                checkPrivateKey={() => false}
                onFinished={() => {}}
                keyInfo={{
                    passphrase: {
                        salt: 'nonempty',
                        iterations: 2,
                    },
                }}
            />,
        );
        const e = { target: { value: "a" } };
        stubClient();
        MatrixClientPeg.get().isValidRecoveryKey = () => false;
        wrapper.instance().onPassPhraseChange(e);
        await wrapper.instance().onPassPhraseNext({ preventDefault: () => { } });

        wrapper.setProps({});
        const notification = wrapper.find(".mx_AccessSecretStorageDialog_keyStatus");
        expect(notification.props().children).toEqual(
            ["\uD83D\uDC4E ", "Unable to access secret storage. Please verify that you " +
                "entered the correct Security Phrase."]);
    });
});
