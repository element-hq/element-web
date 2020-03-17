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
import { _t } from '../../../languageHandler';
import Modal from "../../../Modal";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import DeviceListener from '../../../DeviceListener';
import NewSessionReviewDialog from '../dialogs/NewSessionReviewDialog';
import FormButton from '../elements/FormButton';
import { replaceableComponent } from '../../../utils/replaceableComponent';

@replaceableComponent("views.toasts.UnverifiedSessionToast")
export default class UnverifiedSessionToast extends React.PureComponent {
    static propTypes = {
        toastKey: PropTypes.string.isRequired,
        device: PropTypes.object.isRequired,
    };

    _onLaterClick = () => {
        const { device } = this.props;
        DeviceListener.sharedInstance().dismissVerification(device.deviceId);
    };

    _onReviewClick = async () => {
        const { device } = this.props;

        Modal.createTrackedDialog('New Session Review', 'Starting dialog', NewSessionReviewDialog, {
            userId: MatrixClientPeg.get().getUserId(),
            device,
            onFinished: (r) => {
                if (!r) {
                    /* This'll come back false if the user clicks "this wasn't me" and saw a warning dialog */
                    this._onLaterClick();
                }
            },
        }, null, /* priority = */ false, /* static = */ true);
    };

    render() {
        const { device } = this.props;

        return (<div>
            <div className="mx_Toast_description">
                <span className="mx_Toast_deviceName">
                    {device.getDisplayName()}
                </span> <span className="mx_Toast_deviceID">
                    ({device.deviceId})
                </span>
            </div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Later")} kind="danger" onClick={this._onLaterClick} />
                <FormButton label={_t("Review")} onClick={this._onReviewClick} />
            </div>
        </div>);
    }
}
