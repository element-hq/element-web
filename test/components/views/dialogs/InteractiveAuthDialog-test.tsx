/*
Copyright 2016 OpenMarket Ltd
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
import { act } from 'react-dom/test-utils';
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from 'enzyme';

import InteractiveAuthDialog from "../../../../src/components/views/dialogs/InteractiveAuthDialog";
import { flushPromises, getMockClientWithEventEmitter, unmockClientPeg } from '../../../test-utils';

describe('InteractiveAuthDialog', function() {
    const mockClient = getMockClientWithEventEmitter({
        generateClientSecret: jest.fn().mockReturnValue('t35tcl1Ent5ECr3T'),
    });

    const defaultProps = {
        matrixClient: mockClient,
        makeRequest: jest.fn().mockResolvedValue(undefined),
        onFinished: jest.fn(),
    };
    const getComponent = (props = {}) => mount(<InteractiveAuthDialog
        {...defaultProps}
        {...props}
    />);

    beforeEach(function() {
        jest.clearAllMocks();
        mockClient.credentials = null;
    });

    afterAll(() => {
        unmockClientPeg();
    });

    const getSubmitButton = (wrapper: ReactWrapper) => wrapper.find('[type="submit"]').at(0);

    it('Should successfully complete a password flow', async () => {
        const onFinished = jest.fn();
        const makeRequest = jest.fn().mockResolvedValue({ a: 1 });

        mockClient.credentials = { userId: "@user:id" };
        const authData = {
            session: "sess",
            flows: [
                { "stages": ["m.login.password"] },
            ],
        };

        const wrapper = getComponent({ makeRequest, onFinished, authData });

        const passwordNode = wrapper.find('input[type="password"]').at(0);
        const submitNode = getSubmitButton(wrapper);

        const formNode = wrapper.find('form').at(0);
        expect(passwordNode).toBeTruthy();
        expect(submitNode).toBeTruthy();

        // submit should be disabled
        expect(submitNode.props().disabled).toBe(true);

        // put something in the password box
        act(() => {
            passwordNode.simulate('change', { target: { value: "s3kr3t" } });
            wrapper.setProps({});
        });

        expect(wrapper.find('input[type="password"]').at(0).props().value).toEqual("s3kr3t");
        expect(getSubmitButton(wrapper).props().disabled).toBe(false);

        // hit enter; that should trigger a request
        act(() => {
            formNode.simulate('submit');
        });

        // wait for auth request to resolve
        await flushPromises();

        expect(makeRequest).toHaveBeenCalledTimes(1);
        expect(makeRequest).toBeCalledWith(expect.objectContaining({
            session: "sess",
            type: "m.login.password",
            password: "s3kr3t",
            identifier: {
                type: "m.id.user",
                user: "@user:id",
            },
        }));

        expect(onFinished).toBeCalledTimes(1);
        expect(onFinished).toBeCalledWith(true, { a: 1 });
    });
});
