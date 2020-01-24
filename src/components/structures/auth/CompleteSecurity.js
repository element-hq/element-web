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
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { accessSecretStorage } from '../../../CrossSigningManager';

const PHASE_INTRO = 0;
const PHASE_DONE = 1;
const PHASE_CONFIRM_SKIP = 2;

export default class CompleteSecurity extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            phase: PHASE_INTRO,
        };
    }

    onStartClick = async () => {
        const cli = MatrixClientPeg.get();
        try {
            await accessSecretStorage(async () => {
                await cli.checkOwnCrossSigningTrust();
            });

            if (cli.getCrossSigningId()) {
                this.setState({
                    phase: PHASE_DONE,
                });
            }
        } catch (e) {
            // this will throw if the user hits cancel, so ignore
        }
    }

    onSkipClick = () => {
        this.setState({
            phase: PHASE_CONFIRM_SKIP,
        });
    }

    onSkipConfirmClick = () => {
        this.props.onFinished();
    }

    onSkipBackClick = () => {
        this.setState({
            phase: PHASE_INTRO,
        });
    }

    onDoneClick = () => {
        this.props.onFinished();
    }

    render() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const AuthBody = sdk.getComponent("auth.AuthBody");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const {
            phase,
        } = this.state;

        let icon;
        let title;
        let body;
        if (phase === PHASE_INTRO) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning"></span>;
            title = _t("Complete security");
            body = (
                <div>
                    <p>{_t(
                        "Verify this session to grant it access to encrypted messages.",
                    )}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            kind="danger"
                            onClick={this.onSkipClick}
                        >
                            {_t("Skip")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="primary"
                            onClick={this.onStartClick}
                        >
                            {_t("Start")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_DONE) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_verified"></span>;
            title = _t("Session verified");
            body = (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified"></div>
                    <p>{_t(
                        "Your new session is now verified. It has access to your " +
                        "encrypted messages, and other users will see it as trusted.",
                    )}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            kind="primary"
                            onClick={this.onDoneClick}
                        >
                            {_t("Done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_CONFIRM_SKIP) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning"></span>;
            title = _t("Are you sure?");
            body = (
                <div>
                    <p>{_t(
                        "Without completing security on this device, it won’t have " +
                        "access to encrypted messages.",
                    )}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            className="warning"
                            kind="secondary"
                            onClick={this.onSkipConfirmClick}
                        >
                            {_t("Skip")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="danger"
                            onClick={this.onSkipBackClick}
                        >
                            {_t("Go Back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else {
            throw new Error(`Unknown phase ${phase}`);
        }

        return (
            <AuthPage>
                <AuthBody header={false}>
                    <h2 className="mx_CompleteSecurity_header">
                        {icon}
                        {title}
                    </h2>
                    <div className="mx_CompleteSecurity_body">
                        {body}
                    </div>
                </AuthBody>
            </AuthPage>
        );
    }
}
