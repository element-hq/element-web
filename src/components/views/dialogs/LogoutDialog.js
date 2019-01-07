/*
Copyright 2018, 2019 New Vector Ltd

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
import Modal from '../../../Modal';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import SettingsStore from "../../../settings/SettingsStore";

export default class LogoutDialog extends React.Component {
    constructor() {
        super();
        this._onSettingsLinkClick = this._onSettingsLinkClick.bind(this);
        this._onExportE2eKeysClicked = this._onExportE2eKeysClicked.bind(this);
        this._onFinished = this._onFinished.bind(this);
        this._onSetRecoveryMethodClick = this._onSetRecoveryMethodClick.bind(this);
        this._onLogoutConfirm = this._onLogoutConfirm.bind(this);
    }

    _onSettingsLinkClick() {
        // close dialog
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    }

    _onExportE2eKeysClicked() {
        Modal.createTrackedDialogAsync('Export E2E Keys', '',
            import('../../../async-components/views/dialogs/ExportE2eKeysDialog'),
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    }

    _onFinished(confirmed) {
        if (confirmed) {
            dis.dispatch({action: 'logout'});
        }
        // close dialog
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    }

    _onSetRecoveryMethodClick() {
        Modal.createTrackedDialogAsync('Key Backup', 'Key Backup',
            import('../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog'),
        );

        // close dialog
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    }

    _onLogoutConfirm() {
        dis.dispatch({action: 'logout'});

        // close dialog
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    }

    render() {
        let description;
        if (SettingsStore.isFeatureEnabled("feature_keybackup")) {
            description = <div>
                <p>{_t(
                    "When you log out, you'll lose your secure message history. To prevent " +
                    "this, set up a recovery method.",
                )}</p>
                <p>{_t(
                    "Alternatively, advanced users can also manually export encryption keys in " +
                    "<a>Settings</a> before logging out.", {},
                    {
                        a: sub => <a href='#/settings' onClick={this._onSettingsLinkClick}>{sub}</a>,
                    },
                )}</p>
            </div>;
        } else {
            description = <div>{_t(
                "For security, logging out will delete any end-to-end " +
                "encryption keys from this browser. If you want to be able " +
                "to decrypt your conversation history from future Riot sessions, " +
                "please export your room keys for safe-keeping.",
            )}</div>;
        }

        if (SettingsStore.isFeatureEnabled("feature_keybackup")) {
            if (!MatrixClientPeg.get().getKeyBackupEnabled()) {
                const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
                const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
                // Not quite a standard question dialog as the primary button cancels
                // the action and does something else instead, whilst non-default button
                // confirms the action.
                return (<BaseDialog
                    title={_t("Warning!")}
                    contentId='mx_Dialog_content'
                    hasCancel={false}
                    onFinsihed={this._onFinished}
                >
                    <div className="mx_Dialog_content" id='mx_Dialog_content'>
                        { description }
                    </div>
                    <DialogButtons primaryButton={_t('Set a Recovery Method')}
                        hasCancel={false}
                        onPrimaryButtonClick={this._onSetRecoveryMethodClick}
                        focus={true}
                    >
                        <button onClick={this._onLogoutConfirm}>
                            {_t("I understand, log out without")}
                        </button>
                    </DialogButtons>
                </BaseDialog>);
            } else {
                const QuestionDialog = sdk.getComponent('views.dialogs.QuestionDialog');
                return (<QuestionDialog
                    hasCancelButton={true}
                    title={_t("Sign out")}
                    // TODO: This is made up by me and would need to also mention verifying
                    // once you can restorew a backup by verifying a device
                    description={_t(
                        "When signing in again, you can access encrypted chat history by " +
                        "restoring your key backup. You'll need your recovery key.",
                    )}
                    button={_t("Sign out")}
                    onFinished={this._onFinished}
                />);
            }
        } else {
            const QuestionDialog = sdk.getComponent('views.dialogs.QuestionDialog');
            return (<QuestionDialog
                hasCancelButton={true}
                title={_t("Sign out")}
                description={description}
                button={_t("Sign out")}
                extraButtons={[
                    (<button key="export" className="mx_Dialog_primary"
                            onClick={this._onExportE2eKeysClicked}>
                       { _t("Export E2E room keys") }
                    </button>),
                ]}
                onFinished={this._onFinished}
            />);
        }
    }
}
