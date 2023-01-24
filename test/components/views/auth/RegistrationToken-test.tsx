/*
Copyright 2016 OpenMarket Ltd
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2022 Callum Brown

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

import React from "react";
import { act } from "react-dom/test-utils";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";

import InteractiveAuthComponent from "../../../../src/components/structures/InteractiveAuth";
import { flushPromises, getMockClientWithEventEmitter, unmockClientPeg } from "../../../test-utils";

describe("InteractiveAuthComponent", function () {
    const mockClient = getMockClientWithEventEmitter({
        generateClientSecret: jest.fn().mockReturnValue("t35tcl1Ent5ECr3T"),
    });

    const defaultProps = {
        matrixClient: mockClient,
        makeRequest: jest.fn().mockResolvedValue(undefined),
        onAuthFinished: jest.fn(),
    };
    const getComponent = (props = {}) => mount(<InteractiveAuthComponent {...defaultProps} {...props} />);

    beforeEach(function () {
        jest.clearAllMocks();
    });

    afterAll(() => {
        unmockClientPeg();
    });

    const getSubmitButton = (wrapper: ReactWrapper) => wrapper.find('AccessibleButton[kind="primary"]').at(0);
    const getRegistrationTokenInput = (wrapper: ReactWrapper) =>
        wrapper.find('input[name="registrationTokenField"]').at(0);

    it("Should successfully complete a registration token flow", async () => {
        const onAuthFinished = jest.fn();
        const makeRequest = jest.fn().mockResolvedValue({ a: 1 });

        const authData = {
            session: "sess",
            flows: [{ stages: ["m.login.registration_token"] }],
        };

        const wrapper = getComponent({ makeRequest, onAuthFinished, authData });

        const registrationTokenNode = getRegistrationTokenInput(wrapper);
        const submitNode = getSubmitButton(wrapper);
        const formNode = wrapper.find("form").at(0);

        expect(registrationTokenNode).toBeTruthy();
        expect(submitNode).toBeTruthy();
        expect(formNode).toBeTruthy();

        // submit should be disabled
        expect(submitNode.props().disabled).toBe(true);

        // put something in the registration token box
        act(() => {
            registrationTokenNode.simulate("change", { target: { value: "s3kr3t" } });
            wrapper.setProps({});
        });

        expect(getRegistrationTokenInput(wrapper).props().value).toEqual("s3kr3t");
        expect(getSubmitButton(wrapper).props().disabled).toBe(false);

        // hit enter; that should trigger a request
        act(() => {
            formNode.simulate("submit");
        });

        // wait for auth request to resolve
        await flushPromises();

        expect(makeRequest).toHaveBeenCalledTimes(1);
        expect(makeRequest).toBeCalledWith(
            expect.objectContaining({
                session: "sess",
                type: "m.login.registration_token",
                token: "s3kr3t",
            }),
        );

        expect(onAuthFinished).toBeCalledTimes(1);
        expect(onAuthFinished).toBeCalledWith(
            true,
            { a: 1 },
            { clientSecret: "t35tcl1Ent5ECr3T", emailSid: undefined },
        );
    });
});
