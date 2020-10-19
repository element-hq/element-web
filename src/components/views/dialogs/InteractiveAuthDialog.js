/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
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

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

import AccessibleButton from '../elements/AccessibleButton';
import {ERROR_USER_CANCELLED} from "../../structures/InteractiveAuth";
import {SSOAuthEntry} from "../auth/InteractiveAuthEntryComponents";

export default class InteractiveAuthDialog extends React.Component {
    static propTypes = {
        // matrix client to use for UI auth requests
        matrixClient: PropTypes.object.isRequired,

        // response from initial request. If not supplied, will do a request on
        // mount.
        authData: PropTypes.shape({
            flows: PropTypes.array,
            params: PropTypes.object,
            session: PropTypes.string,
        }),

        // callback
        makeRequest: PropTypes.func.isRequired,

        onFinished: PropTypes.func.isRequired,

        // Optional title and body to show when not showing a particular stage
        title: PropTypes.string,
        body: PropTypes.string,

        // Optional title and body pairs for particular stages and phases within
        // those stages. Object structure/example is:
        // {
        //     "org.example.stage_type": {
        //         1: {
        //             "body": "This is a body for phase 1" of org.example.stage_type,
        //             "title": "Title for phase 1 of org.example.stage_type"
        //         },
        //         2: {
        //             "body": "This is a body for phase 2 of org.example.stage_type",
        //             "title": "Title for phase 2 of org.example.stage_type"
        //             "continueText": "Confirm identity with Example Auth",
        //             "continueKind": "danger"
        //         }
        //     }
        // }
        //
        // Default is defined in _getDefaultDialogAesthetics()
        aestheticsForStagePhases: PropTypes.object,
    };

    state = {
        authError: null,

        // See _onUpdateStagePhase()
        uiaStage: null,
        uiaStagePhase: null,
    };

    _getDefaultDialogAesthetics() {
        const ssoAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                title: _t("Use Single Sign On to continue"),
                body: _t("To continue, use Single Sign On to prove your identity."),
                continueText: _t("Single Sign On"),
                continueKind: "primary",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                title: _t("Confirm to continue"),
                body: _t("Click the button below to confirm your identity."),
                continueText: _t("Confirm"),
                continueKind: "primary",
            },
        };

        return {
            [SSOAuthEntry.LOGIN_TYPE]: ssoAesthetics,
            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: ssoAesthetics,
        };
    }

    _onAuthFinished = (success, result) => {
        if (success) {
            this.props.onFinished(true, result);
        } else {
            if (result === ERROR_USER_CANCELLED) {
                this.props.onFinished(false, null);
            } else {
                this.setState({
                    authError: result,
                });
            }
        }
    };

    _onUpdateStagePhase = (newStage, newPhase) => {
        // We copy the stage and stage phase params into state for title selection in render()
        this.setState({uiaStage: newStage, uiaStagePhase: newPhase});
    };

    _onDismissClick = () => {
        this.props.onFinished(false);
    };

    render() {
        const InteractiveAuth = sdk.getComponent("structures.InteractiveAuth");
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        // Let's pick a title, body, and other params text that we'll show to the user. The order
        // is most specific first, so stagePhase > our props > defaults.

        let title = this.state.authError ? 'Error' : (this.props.title || _t('Authentication'));
        let body = this.state.authError ? null : this.props.body;
        let continueText = null;
        let continueKind = null;
        const dialogAesthetics = this.props.aestheticsForStagePhases || this._getDefaultDialogAesthetics();
        if (!this.state.authError && dialogAesthetics) {
            if (dialogAesthetics[this.state.uiaStage]) {
                const aesthetics = dialogAesthetics[this.state.uiaStage][this.state.uiaStagePhase];
                if (aesthetics && aesthetics.title) title = aesthetics.title;
                if (aesthetics && aesthetics.body) body = aesthetics.body;
                if (aesthetics && aesthetics.continueText) continueText = aesthetics.continueText;
                if (aesthetics && aesthetics.continueKind) continueKind = aesthetics.continueKind;
            }
        }

        let content;
        if (this.state.authError) {
            content = (
                <div id='mx_Dialog_content'>
                    <div role="alert">{ this.state.authError.message || this.state.authError.toString() }</div>
                    <br />
                    <AccessibleButton onClick={this._onDismissClick}
                        className="mx_GeneralButton"
                        autoFocus="true"
                    >
                        { _t("Dismiss") }
                    </AccessibleButton>
                </div>
            );
        } else {
            content = (
                <div id='mx_Dialog_content'>
                    {body}
                    <InteractiveAuth
                        ref={this._collectInteractiveAuth}
                        matrixClient={this.props.matrixClient}
                        authData={this.props.authData}
                        makeRequest={this.props.makeRequest}
                        onAuthFinished={this._onAuthFinished}
                        onStagePhaseChange={this._onUpdateStagePhase}
                        continueText={continueText}
                        continueKind={continueKind}
                    />
                </div>
            );
        }

        return (
            <BaseDialog className="mx_InteractiveAuthDialog"
                onFinished={this.props.onFinished}
                title={title}
                contentId='mx_Dialog_content'
            >
                { content }
            </BaseDialog>
        );
    }
}
