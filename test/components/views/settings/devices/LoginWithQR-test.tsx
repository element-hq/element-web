/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mocked } from 'jest-mock';
import React from 'react';
import { MSC3886SimpleHttpRendezvousTransport } from 'matrix-js-sdk/src/rendezvous/transports';
import { MSC3906Rendezvous, RendezvousFailureReason } from 'matrix-js-sdk/src/rendezvous';

import LoginWithQR, { Mode } from '../../../../../src/components/views/auth/LoginWithQR';
import type { MatrixClient } from 'matrix-js-sdk/src/matrix';
import { flushPromisesWithFakeTimers } from '../../../../test-utils';

jest.useFakeTimers();

jest.mock('matrix-js-sdk/src/rendezvous');
jest.mock('matrix-js-sdk/src/rendezvous/transports');
jest.mock('matrix-js-sdk/src/rendezvous/channels');

function makeClient() {
    return mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        isCryptoEnabled: jest.fn(),
        getUserId: jest.fn(),
        on: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        mxcUrlToHttp: jest.fn().mockReturnValue('mock-mxcUrlToHttp'),
        doesServerSupportUnstableFeature: jest.fn().mockReturnValue(true),
        removeListener: jest.fn(),
        requestLoginToken: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
    } as unknown as MatrixClient);
}

describe('<LoginWithQR />', () => {
    const client = makeClient();
    const defaultProps = {
        mode: Mode.Show,
        onFinished: jest.fn(),
    };
    const mockConfirmationDigits = 'mock-confirmation-digits';
    const newDeviceId = 'new-device-id';

    const getComponent = (props: { client: MatrixClient, onFinished?: () => void }) =>
        (<LoginWithQR {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(MSC3906Rendezvous.prototype, 'generateCode').mockRestore();
        jest.spyOn(MSC3906Rendezvous.prototype, 'cancel').mockResolvedValue();
        jest.spyOn(MSC3906Rendezvous.prototype, 'declineLoginOnExistingDevice').mockResolvedValue();
        jest.spyOn(MSC3906Rendezvous.prototype, 'startAfterShowingCode').mockResolvedValue(mockConfirmationDigits);
        jest.spyOn(MSC3906Rendezvous.prototype, 'approveLoginOnExistingDevice').mockResolvedValue(newDeviceId);
        client.requestLoginToken.mockResolvedValue({
            login_token: 'token',
            expires_in: 1000,
        });
        // @ts-ignore
        client.crypto = undefined;
    });

    it('no content in case of no support', async () => {
        // simulate no support
        jest.spyOn(MSC3906Rendezvous.prototype, 'generateCode').mockRejectedValue('');
        const { container } = render(getComponent({ client }));
        await waitFor(() => screen.getAllByTestId('cancellation-message').length === 1);
        expect(container).toMatchSnapshot();
    });

    it('renders spinner while generating code', async () => {
        const { container } = render(getComponent({ client }));
        expect(container).toMatchSnapshot();
    });

    it('cancels rendezvous after user goes back', async () => {
        const { getByTestId } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        // flush generate code promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('back-button'));

        // wait for cancel
        await flushPromisesWithFakeTimers();

        expect(rendezvous.cancel).toHaveBeenCalledWith(RendezvousFailureReason.UserCancelled);
    });

    it('displays qr code after it is created', async () => {
        const { container, getByText } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        await flushPromisesWithFakeTimers();

        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(getByText('Sign in with QR code')).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it('displays confirmation digits after connected to rendezvous', async () => {
        const { container, getByText } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        expect(container).toMatchSnapshot();
        expect(getByText(mockConfirmationDigits)).toBeTruthy();
    });

    it('displays unknown error if connection to rendezvous fails', async () => {
        const { container } = render(getComponent({ client }));
        expect(MSC3886SimpleHttpRendezvousTransport).toHaveBeenCalledWith({
            onFailure: expect.any(Function),
            client,
        });
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';
        mocked(rendezvous).startAfterShowingCode.mockRejectedValue('oups');

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        expect(container).toMatchSnapshot();
    });

    it('declines login', async () => {
        const { getByTestId } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('decline-login-button'));

        expect(rendezvous.declineLoginOnExistingDevice).toHaveBeenCalled();
    });

    it('displays error when approving login fails', async () => {
        const { container, getByTestId } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';
        client.requestLoginToken.mockRejectedValue('oups');

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('approve-login-button'));

        expect(client.requestLoginToken).toHaveBeenCalled();
        // flush token request promise
        await flushPromisesWithFakeTimers();
        await flushPromisesWithFakeTimers();

        expect(container).toMatchSnapshot();
    });

    it('approves login and waits for new device', async () => {
        const { container, getByTestId, getByText } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('approve-login-button'));

        expect(client.requestLoginToken).toHaveBeenCalled();
        // flush token request promise
        await flushPromisesWithFakeTimers();
        await flushPromisesWithFakeTimers();

        expect(getByText('Waiting for device to sign in')).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it('does not continue with verification when user denies login', async () => {
        const onFinished = jest.fn();
        const { getByTestId } = render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';
        // no device id returned => user denied
        mocked(rendezvous).approveLoginOnExistingDevice.mockReturnValue(undefined);

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('approve-login-button'));

        // flush token request promise
        await flushPromisesWithFakeTimers();
        await flushPromisesWithFakeTimers();

        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalled();

        await flushPromisesWithFakeTimers();
        expect(onFinished).not.toHaveBeenCalled();
        expect(rendezvous.verifyNewDeviceOnExistingDevice).not.toHaveBeenCalled();
    });

    it('waits for device approval on existing device and finishes when crypto is not setup', async () => {
        const { getByTestId } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('approve-login-button'));

        // flush token request promise
        await flushPromisesWithFakeTimers();
        await flushPromisesWithFakeTimers();

        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalled();
        await flushPromisesWithFakeTimers();
        expect(defaultProps.onFinished).toHaveBeenCalledWith(true);
        // didnt attempt verification
        expect(rendezvous.verifyNewDeviceOnExistingDevice).not.toHaveBeenCalled();
    });

    it('waits for device approval on existing device and verifies device', async () => {
        const { getByTestId } = render(getComponent({ client }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        // @ts-ignore assign to private prop
        rendezvous.code = 'rendezvous-code';
        // we just check for presence of crypto
        // pretend it is set up
        // @ts-ignore
        client.crypto = {};

        // flush generate code promise
        await flushPromisesWithFakeTimers();
        // flush waiting for connection promise
        await flushPromisesWithFakeTimers();

        fireEvent.click(getByTestId('approve-login-button'));

        // flush token request promise
        await flushPromisesWithFakeTimers();
        await flushPromisesWithFakeTimers();

        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalled();
        // flush login approval
        await flushPromisesWithFakeTimers();
        expect(rendezvous.verifyNewDeviceOnExistingDevice).toHaveBeenCalled();
        // flush verification
        await flushPromisesWithFakeTimers();
        expect(defaultProps.onFinished).toHaveBeenCalledWith(true);
    });
});
