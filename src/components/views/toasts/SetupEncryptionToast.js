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
import Modal from '../../../Modal';
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';
import DeviceListener from '../../../DeviceListener';
import SetupEncryptionDialog from "../dialogs/SetupEncryptionDialog";
import { accessSecretStorage } from '../../../CrossSigningManager';

export default class SetupEncryptionToast extends React.PureComponent {
    static propTypes = {
        toastKey: PropTypes.string.isRequired,
        kind: PropTypes.oneOf([
            'set_up_encryption',
            'verify_this_session',
            'upgrade_encryption',
        ]).isRequired,
    };

    _onLaterClick = () => {
        DeviceListener.sharedInstance().dismissEncryptionSetup();
    };

    _onSetupClick = async () => {
        if (this.props.kind === "verify_this_session") {
            Modal.createTrackedDialog('Verify session', 'Verify session', SetupEncryptionDialog,
                {}, null, /* priority = */ false, /* static = */ true);
        } else {
            const Spinner = sdk.getComponent("elements.Spinner");
            const modal = Modal.createDialog(
                Spinner, null, 'mx_Dialog_spinner', /* priority */ false, /* static */ true,
            );
            try {
                await accessSecretStorage();
            } finally {
                modal.close();
            }
        }
    };

    getDescription() {
        switch (this.props.kind) {
            case 'set_up_encryption':
            case 'upgrade_encryption':
                return _t('Verify yourself & others to keep your chats safe');
            case 'verify_this_session':
                return _t('Other users may not trust it');
        }
    }

    getSetupCaption() {
        switch (this.props.kind) {
            case 'set_up_encryption':
                return _t('Set up');
            case 'upgrade_encryption':
                return _t('Upgrade');
            case 'verify_this_session':
                return _t('Verify');
        }
    }

    render() {
        const FormButton = sdk.getComponent("elements.FormButton");
        return (<div>
            <div className="mx_Toast_description">{this.getDescription()}</div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Later")} kind="danger" onClick={this._onLaterClick} />
                <FormButton label={this.getSetupCaption()} onClick={this._onSetupClick} />
            </div>
        </div>);
    }
}
