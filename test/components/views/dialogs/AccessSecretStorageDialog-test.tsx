/*
Copyright 2020, 2022 The Matrix.org Foundation C.I.C.

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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { IPassphraseInfo } from 'matrix-js-sdk/src/crypto/api';

import { findByTestId, getMockClientWithEventEmitter, unmockClientPeg } from '../../../test-utils';
import { findById, flushPromises } from '../../../test-utils';
import AccessSecretStorageDialog from "../../../../src/components/views/dialogs/security/AccessSecretStorageDialog";

describe("AccessSecretStorageDialog", () => {
    const mockClient = getMockClientWithEventEmitter({
        keyBackupKeyFromRecoveryKey: jest.fn(),
        checkSecretStorageKey: jest.fn(),
        isValidRecoveryKey: jest.fn(),
    });
    const defaultProps = {
        onFinished: jest.fn(),
        checkPrivateKey: jest.fn(),
        keyInfo: undefined,
    };
    const getComponent = (props ={}): ReactWrapper =>
        mount(<AccessSecretStorageDialog {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.keyBackupKeyFromRecoveryKey.mockReturnValue('a raw key' as unknown as Uint8Array);
        mockClient.isValidRecoveryKey.mockReturnValue(false);
    });

    afterAll(() => {
        unmockClientPeg();
    });

    it("Closes the dialog when the form is submitted with a valid key", async () => {
        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        const wrapper = getComponent({ onFinished, checkPrivateKey });

        // force into valid state
        act(() => {
            wrapper.setState({
                recoveryKeyValid: true,
                recoveryKey: "a",
            });
        });
        const e = { preventDefault: () => {} };

        act(() => {
            wrapper.find('form').simulate('submit', e);
        });

        await flushPromises();

        expect(checkPrivateKey).toHaveBeenCalledWith({ recoveryKey: "a" });
        expect(onFinished).toHaveBeenCalledWith({ recoveryKey: "a" });
    });

    it("Considers a valid key to be valid", async () => {
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        const wrapper = getComponent({ checkPrivateKey });
        mockClient.keyBackupKeyFromRecoveryKey.mockReturnValue('a raw key' as unknown as Uint8Array);
        mockClient.checkSecretStorageKey.mockResolvedValue(true);

        const v = "asdf";
        const e = { target: { value: v } };
        act(() => {
            findById(wrapper, 'mx_securityKey').find('input').simulate('change', e);
            wrapper.setProps({});
        });
        await act(async () => {
            // force a validation now because it debounces
            // @ts-ignore
            await wrapper.instance().validateRecoveryKey();
            wrapper.setProps({});
        });

        const submitButton = findByTestId(wrapper, 'dialog-primary-button').at(0);
        // submit button is enabled when key is valid
        expect(submitButton.props().disabled).toBeFalsy();
        expect(wrapper.find('.mx_AccessSecretStorageDialog_recoveryKeyFeedback').text()).toEqual('Looks good!');
    });

    it("Notifies the user if they input an invalid Security Key", async () => {
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        const wrapper = getComponent({ checkPrivateKey });
        const e = { target: { value: "a" } };
        mockClient.keyBackupKeyFromRecoveryKey.mockImplementation(() => {
            throw new Error("that's no key");
        });

        act(() => {
            findById(wrapper, 'mx_securityKey').find('input').simulate('change', e);
        });
        // force a validation now because it debounces
        // @ts-ignore private
        await wrapper.instance().validateRecoveryKey();

        const submitButton = findByTestId(wrapper, 'dialog-primary-button').at(0);
        // submit button is disabled when recovery key is invalid
        expect(submitButton.props().disabled).toBeTruthy();
        expect(
            wrapper.find('.mx_AccessSecretStorageDialog_recoveryKeyFeedback').text(),
        ).toEqual('Invalid Security Key');

        wrapper.setProps({});
        const notification = wrapper.find(".mx_AccessSecretStorageDialog_recoveryKeyFeedback");
        expect(notification.props().children).toEqual("Invalid Security Key");
    });

    it("Notifies the user if they input an invalid passphrase", async function() {
        const keyInfo = {
            name: 'test',
            algorithm: 'test',
            iv: 'test',
            mac: '1:2:3:4',
            passphrase: {
                // this type is weird in js-sdk
                // cast 'm.pbkdf2' to itself
                algorithm: 'm.pbkdf2' as IPassphraseInfo['algorithm'],
                iterations: 2,
                salt: 'nonempty',
            },
        };
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        const wrapper = getComponent({ checkPrivateKey, keyInfo });
        mockClient.isValidRecoveryKey.mockReturnValue(false);

        // update passphrase
        act(() => {
            const e = { target: { value: "a" } };
            findById(wrapper, 'mx_passPhraseInput').at(1).simulate('change', e);
        });
        wrapper.setProps({});

        // input updated
        expect(findById(wrapper, 'mx_passPhraseInput').at(0).props().value).toEqual('a');

        // submit the form
        act(() => {
            wrapper.find('form').at(0).simulate('submit');
        });
        await flushPromises();

        wrapper.setProps({});
        const notification = wrapper.find(".mx_AccessSecretStorageDialog_keyStatus");
        expect(notification.props().children).toEqual(
            ["\uD83D\uDC4E ", "Unable to access secret storage. Please verify that you " +
                "entered the correct Security Phrase."]);
    });
});
