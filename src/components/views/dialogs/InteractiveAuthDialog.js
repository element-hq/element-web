/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

import AccessibleButton from '../elements/AccessibleButton';

export default createReactClass({
    displayName: 'InteractiveAuthDialog',

    propTypes: {
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

        title: PropTypes.string,
    },

    getInitialState: function() {
        return {
            authError: null,
        };
    },

    _onAuthFinished: function(success, result) {
        if (success) {
            this.props.onFinished(true, result);
        } else {
            this.setState({
                authError: result,
            });
        }
    },

    _onDismissClick: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const InteractiveAuth = sdk.getComponent("structures.InteractiveAuth");
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

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
                    <InteractiveAuth ref={this._collectInteractiveAuth}
                        matrixClient={this.props.matrixClient}
                        authData={this.props.authData}
                        makeRequest={this.props.makeRequest}
                        onAuthFinished={this._onAuthFinished}
                    />
                </div>
            );
        }

        return (
            <BaseDialog className="mx_InteractiveAuthDialog"
                onFinished={this.props.onFinished}
                title={this.state.authError ? 'Error' : (this.props.title || _t('Authentication'))}
                contentId='mx_Dialog_content'
            >
                { content }
            </BaseDialog>
        );
    },
});
