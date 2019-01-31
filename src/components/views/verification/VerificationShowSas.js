/*
Copyright 2019 Vector Creations Ltd

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
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default class VerificationShowSas extends React.Component {
    static propTypes = {
        onDone: PropTypes.func.isRequired,
        onCancel: PropTypes.func.isRequired,
        sas: PropTypes.string.isRequired,
    }

    constructor() {
        super();
        this.state = {
            sasVerified: false,
        };
    }

    _onVerifiedStateChange = (newVal) => {
        this.setState({sasVerified: newVal});
    }

    render() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const HexVerify = sdk.getComponent('views.elements.HexVerify');
        return <div>
            <p>{_t(
                "Verify this user by confirming the following number appears on their screen.",
            )}</p>
            <p>{_t(
                "For maximum security, we recommend you do this in person or use another " +
                "trusted means of communication.",
            )}</p>
            <HexVerify text={this.props.sas}
                onVerifiedStateChange={this._onVerifiedStateChange}
            />
            <p>{_t(
                "To continue, click on each pair to confirm it's correct.",
            )}</p>
            <DialogButtons onPrimaryButtonClick={this.props.onDone}
                primaryButton={_t("Continue")}
                primaryDisabled={!this.state.sasVerified}
                hasCancel={true}
                onCancel={this.props.onCancel}
            />
        </div>;
    }
}
