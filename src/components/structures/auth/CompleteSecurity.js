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
import * as sdk from '../../../index';
import {
    SetupEncryptionStore,
    PHASE_INTRO,
    PHASE_BUSY,
    PHASE_DONE,
    PHASE_CONFIRM_SKIP,
} from '../../../stores/SetupEncryptionStore';
import SetupEncryptionBody from "./SetupEncryptionBody";

export default class CompleteSecurity extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor() {
        super();
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this._onStoreUpdate);
        store.start();
        this.state = {phase: store.phase};
    }

    _onStoreUpdate = () => {
        const store = SetupEncryptionStore.sharedInstance();
        this.setState({phase: store.phase});
    };

    componentWillUnmount() {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this._onStoreUpdate);
        store.stop();
    }

    render() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const CompleteSecurityBody = sdk.getComponent("auth.CompleteSecurityBody");
        const {phase} = this.state;
        let icon;
        let title;

        if (phase === PHASE_INTRO) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Verify this login");
        } else if (phase === PHASE_DONE) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_verified" />;
            title = _t("Session verified");
        } else if (phase === PHASE_CONFIRM_SKIP) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Are you sure?");
        } else if (phase === PHASE_BUSY) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Verify this login");
        } else {
            throw new Error(`Unknown phase ${phase}`);
        }

        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <h2 className="mx_CompleteSecurity_header">
                        {icon}
                        {title}
                    </h2>
                    <div className="mx_CompleteSecurity_body">
                        <SetupEncryptionBody onFinished={this.props.onFinished} />
                    </div>
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
