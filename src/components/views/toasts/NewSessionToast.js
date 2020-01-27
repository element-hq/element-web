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
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';
import Modal from "../../../Modal";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import DeviceListener from '../../../DeviceListener';

export default class VerifySessionToast extends React.PureComponent {
    static propTypes = {
        toastKey: PropTypes.string.isRequired,
        deviceId: PropTypes.string,
    };

    _onLaterClick = () => {
        DeviceListener.sharedInstance().dismissVerification(this.props.deviceId);
    };

    _onReviewClick = async () => {
        const cli = MatrixClientPeg.get();
        const NewSessionReviewDialog =
            sdk.getComponent('views.dialogs.NewSessionReviewDialog');

        const device = await cli.getStoredDevice(cli.getUserId(), this.props.deviceId);

        Modal.createTrackedDialog('New Session Review', 'Starting dialog', NewSessionReviewDialog, {
            userId: MatrixClientPeg.get().getUserId(),
            device,
        }, null, /* priority = */ false, /* static = */ true);
    };

    render() {
        const FormButton = sdk.getComponent("elements.FormButton");
        return (<div>
            <div className="mx_Toast_description">{_t("Review & verify your new session")}</div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Later")} kind="danger" onClick={this._onLaterClick} />
                <FormButton label={_t("Review")} onClick={this._onReviewClick} />
            </div>
        </div>);
    }
}
