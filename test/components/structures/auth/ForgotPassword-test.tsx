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

import React from 'react';
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { createClient, MatrixClient } from 'matrix-js-sdk/src/matrix';
import { mocked } from 'jest-mock';
import fetchMock from "fetch-mock-jest";

import SdkConfig, { DEFAULTS } from '../../../../src/SdkConfig';
import { mkServerConfig, mockPlatformPeg, unmockPlatformPeg } from "../../../test-utils";
import ForgotPassword from "../../../../src/components/structures/auth/ForgotPassword";
import PasswordReset from "../../../../src/PasswordReset";

jest.mock('matrix-js-sdk/src/matrix');
jest.mock("../../../../src/PasswordReset", () => (jest.fn().mockReturnValue({
    resetPassword: jest.fn().mockReturnValue(new Promise(() => {})),
})));
jest.useFakeTimers();

describe('<ForgotPassword/>', () => {
    const mockClient = mocked({
        doesServerSupportLogoutDevices: jest.fn().mockResolvedValue(true),
    } as unknown as MatrixClient);

    beforeEach(function() {
        SdkConfig.put({
            ...DEFAULTS,
            disable_custom_urls: true,
        });
        mocked(createClient).mockImplementation(opts => {
            mockClient.idBaseUrl = opts.idBaseUrl;
            mockClient.baseUrl = opts.baseUrl;
            return mockClient;
        });
        fetchMock.get("https://matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: [],
        });
        mockPlatformPeg({
            startSingleSignOn: jest.fn(),
        });
    });

    afterEach(function() {
        fetchMock.restore();
        SdkConfig.unset(); // we touch the config, so clean up
        unmockPlatformPeg();
    });

    const defaultProps = {
        defaultDeviceDisplayName: 'test-device-display-name',
        onServerConfigChange: jest.fn(),
        onLoginClick: jest.fn(),
        onComplete: jest.fn(),
    };

    function getRawComponent(hsUrl = "https://matrix.org", isUrl = "https://vector.im") {
        return <ForgotPassword
            {...defaultProps}
            serverConfig={mkServerConfig(hsUrl, isUrl)}
        />;
    }

    it("should handle serverConfig updates correctly", async () => {
        const { container, rerender } = render(getRawComponent());
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading..."));

        fetchMock.get("https://server2/_matrix/client/versions", {
            unstable_features: {},
            versions: [],
        });
        fetchMock.get("https://vector.im/_matrix/identity/api/v1", {});
        rerender(getRawComponent("https://server2"));

        const email = "email@addy.com";
        const pass = "thisIsAT0tallySecurePassword";

        fireEvent.change(container.querySelector('[label=Email]'), { target: { value: email } });
        fireEvent.change(container.querySelector('[label="New Password"]'), { target: { value: pass } });
        fireEvent.change(container.querySelector('[label=Confirm]'), { target: { value: pass } });
        fireEvent.change(container.querySelector('[type=checkbox]')); // this allows us to bypass the modal
        fireEvent.submit(container.querySelector("form"));

        await waitFor(() => {
            return expect(PasswordReset).toHaveBeenCalledWith("https://server2", expect.anything());
        }, { timeout: 5000 });
    });
});
