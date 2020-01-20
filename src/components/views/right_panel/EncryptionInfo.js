/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../../index';
import {_t} from "../../../languageHandler";

export default class EncryptionInfo extends React.PureComponent {
    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (<div className="mx_UserInfo"><div className="mx_UserInfo_container">
            <h3>{_t("Verify User")}</h3>
            <p>{_t("For extra security, verify this user by checking a one-time code on both of your devices.")}</p>
            <p>{_t("For maximum security, do this in person.")}</p>
            <AccessibleButton kind="primary" onClick={this.props.onStartVerification}>{_t("Start Verification")}</AccessibleButton>
        </div></div>);
    }
}
