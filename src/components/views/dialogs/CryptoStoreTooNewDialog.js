/*
Copyright 2018 New Vector Ltd

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
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';

export default (props) => {
    const _onLogoutClicked = () => {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Logout e2e db too new', '', QuestionDialog, {
            title: _t("Sign out"),
            description: _t(
                "To avoid losing your chat history, you must export your room keys " +
                "before logging out. You will need to go back to the newer version of " +
                "Riot to do this",
            ),
            button: _t("Sign out"),
            focus: false,
            onFinished: (doLogout) => {
                if (doLogout) {
                    dis.dispatch({action: 'logout'});
                    props.onFinished();
                }
            },
        });
    };

    const description =
        _t("You've previously used a newer version of Riot with this session. " +
            "To use this version again with end to end encryption, you will " +
            "need to sign out and back in again.");

    const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
    const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
    return (<BaseDialog className="mx_CryptoStoreTooNewDialog"
        contentId='mx_Dialog_content'
        title={_t("Incompatible Database")}
        hasCancel={false}
        onFinished={props.onFinished}
    >
        <div className="mx_Dialog_content" id='mx_Dialog_content'>
            { description }
        </div>
        <DialogButtons primaryButton={_t('Continue With Encryption Disabled')}
            hasCancel={false}
            onPrimaryButtonClick={props.onFinished}
        >
            <button onClick={_onLogoutClicked} >
                { _t('Sign out') }
            </button>
        </DialogButtons>
    </BaseDialog>);
};
