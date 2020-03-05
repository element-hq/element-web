/*
Copyright 2016 OpenMarket Ltd

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
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import MatrixReactTestUtils from 'matrix-react-test-utils';

import sdk from '../../../skinned-sdk';
import {MatrixClientPeg} from '../../../../src/MatrixClientPeg';

import * as test_utils from '../../../test-utils';
import {sleep} from "../../../../src/utils/promise";

const InteractiveAuthDialog = sdk.getComponent(
    'views.dialogs.InteractiveAuthDialog',
);

describe('InteractiveAuthDialog', function() {
    let parentDiv;

    beforeEach(function() {
        test_utils.stubClient();
        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);
    });

    afterEach(function() {
        ReactDOM.unmountComponentAtNode(parentDiv);
        parentDiv.remove();
    });

    it('Should successfully complete a password flow', function() {
        const onFinished = jest.fn();
        const doRequest = jest.fn().mockResolvedValue({a: 1});

        // tell the stub matrixclient to return a real userid
        const client = MatrixClientPeg.get();
        client.credentials = {userId: "@user:id"};

        const dlg = ReactDOM.render(
            <InteractiveAuthDialog
                matrixClient={client}
                authData={{
                    session: "sess",
                    flows: [
                        {"stages": ["m.login.password"]},
                    ],
                }}
                makeRequest={doRequest}
                onFinished={onFinished}
            />, parentDiv);

        // wait for a password box and a submit button
        return MatrixReactTestUtils.waitForRenderedDOMComponentWithTag(dlg, "form", 2).then((formNode) => {
            const inputNodes = ReactTestUtils.scryRenderedDOMComponentsWithTag(
                dlg, "input",
            );
            let passwordNode;
            let submitNode;
            for (const node of inputNodes) {
                if (node.type == 'password') {
                    passwordNode = node;
                } else if (node.type == 'submit') {
                    submitNode = node;
                }
            }
            expect(passwordNode).toBeTruthy();
            expect(submitNode).toBeTruthy();

            // submit should be disabled
            expect(submitNode.disabled).toBe(true);

            // put something in the password box, and hit enter; that should
            // trigger a request
            passwordNode.value = "s3kr3t";
            ReactTestUtils.Simulate.change(passwordNode);
            expect(submitNode.disabled).toBe(false);
            ReactTestUtils.Simulate.submit(formNode, {});

            expect(doRequest).toHaveBeenCalledTimes(1);
            expect(doRequest).toBeCalledWith(expect.objectContaining({
                session: "sess",
                type: "m.login.password",
                password: "s3kr3t",
                identifier: {
                    type: "m.id.user",
                    user: "@user:id",
                },
            }));
            // let the request complete
            return sleep(1);
        }).then(sleep(1)).then(() => {
            expect(onFinished).toBeCalledTimes(1);
            expect(onFinished).toBeCalledWith(true, {a: 1});
        });
    });
});
