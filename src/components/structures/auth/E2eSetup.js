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
import PropTypes from 'prop-types';
import AsyncWrapper from '../../../AsyncWrapper';
import * as sdk from '../../../index';

export default class E2eSetup extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        accountPassword: PropTypes.string,
    };

    constructor() {
        super();
        // awkwardly indented because https://github.com/eslint/eslint/issues/11310
        this._createStorageDialogPromise =
            import("../../../async-components/views/dialogs/secretstorage/CreateSecretStorageDialog");
    }

    render() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const CompleteSecurityBody = sdk.getComponent("auth.CompleteSecurityBody");
        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <AsyncWrapper prom={this._createStorageDialogPromise}
                        hasCancel={false}
                        onFinished={this.props.onFinished}
                        accountPassword={this.props.accountPassword}
                    />
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
