/*
Copyright 2019 New Vector Ltd

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

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { mocked } from 'jest-mock';
import { createClient, MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from '../../../../src/SdkConfig';
import { mkServerConfig } from "../../../test-utils";
import Login from "../../../../src/components/structures/auth/Login";
import PasswordLogin from "../../../../src/components/views/auth/PasswordLogin";

jest.mock("matrix-js-sdk/src/matrix");

const flushPromises = async () => await new Promise(process.nextTick);

jest.useRealTimers();

describe('Login', function() {
    let parentDiv;
    const mockClient = mocked({
        login: jest.fn().mockResolvedValue({}),
        loginFlows: jest.fn(),
    } as unknown as MatrixClient);

    beforeEach(function() {
        SdkConfig.put({
            brand: "test-brand",
            disable_custom_urls: true,
        });
        mockClient.login.mockClear().mockResolvedValue({});
        mockClient.loginFlows.mockClear().mockResolvedValue({ flows: [{ type: "m.login.password" }] });
        mocked(createClient).mockReturnValue(mockClient);

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);
    });

    afterEach(function() {
        ReactDOM.unmountComponentAtNode(parentDiv);
        parentDiv.remove();
        SdkConfig.unset(); // we touch the config, so clean up
    });

    function render() {
        return ReactDOM.render(<Login
            serverConfig={mkServerConfig("https://matrix.org", "https://vector.im")}
            onLoggedIn={() => { }}
            onRegisterClick={() => { }}
            onServerConfigChange={() => { }}
        />, parentDiv) as unknown as Component<any, any, any>;
    }

    it('should show form with change server link', async () => {
        SdkConfig.put({
            brand: "test-brand",
            disable_custom_urls: false,
        });
        const root = render();

        await flushPromises();

        const form = ReactTestUtils.findRenderedComponentWithType(
            root,
            PasswordLogin,
        );
        expect(form).toBeTruthy();

        const changeServerLink = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_ServerPicker_change');
        expect(changeServerLink).toBeTruthy();
    });

    it('should show form without change server link when custom URLs disabled', async () => {
        const root = render();
        await flushPromises();

        const form = ReactTestUtils.findRenderedComponentWithType(
            root,
            PasswordLogin,
        );
        expect(form).toBeTruthy();

        const changeServerLinks = ReactTestUtils.scryRenderedDOMComponentsWithClass(root, 'mx_ServerPicker_change');
        expect(changeServerLinks).toHaveLength(0);
    });

    it("should show SSO button if that flow is available", async () => {
        mockClient.loginFlows.mockResolvedValue({ flows: [{ type: "m.login.sso" }] });

        const root = render();
        await flushPromises();

        const ssoButton = ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_SSOButton");
        expect(ssoButton).toBeTruthy();
    });

    it("should show both SSO button and username+password if both are available", async () => {
        mockClient.loginFlows.mockResolvedValue({ flows: [{ type: "m.login.password" }, { type: "m.login.sso" }] });

        const root = render();
        await flushPromises();

        const form = ReactTestUtils.findRenderedComponentWithType(root, PasswordLogin);
        expect(form).toBeTruthy();

        const ssoButton = ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_SSOButton");
        expect(ssoButton).toBeTruthy();
    });

    it("should show multiple SSO buttons if multiple identity_providers are available", async () => {
        mockClient.loginFlows.mockResolvedValue({
            flows: [{
                "type": "m.login.sso",
                "identity_providers": [{
                    id: "a",
                    name: "Provider 1",
                }, {
                    id: "b",
                    name: "Provider 2",
                }, {
                    id: "c",
                    name: "Provider 3",
                }],
            }],
        });

        const root = render();

        await flushPromises();

        const ssoButtons = ReactTestUtils.scryRenderedDOMComponentsWithClass(root, "mx_SSOButton");
        expect(ssoButtons.length).toBe(3);
    });

    it("should show single SSO button if identity_providers is null", async () => {
        mockClient.loginFlows.mockResolvedValue({
            flows: [{
                "type": "m.login.sso",
            }],
        });

        const root = render();

        await flushPromises();

        const ssoButtons = ReactTestUtils.scryRenderedDOMComponentsWithClass(root, "mx_SSOButton");
        expect(ssoButtons.length).toBe(1);
    });
});
