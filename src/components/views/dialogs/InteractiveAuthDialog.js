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

import Matrix from 'matrix-js-sdk';

import React from 'react';

import sdk from '../../../index';

import AccessibleButton from '../elements/AccessibleButton';

export default React.createClass({
    displayName: 'InteractiveAuthDialog',

    propTypes: {
        // matrix client to use for UI auth requests
        matrixClient: React.PropTypes.object.isRequired,

        // response from initial request. If not supplied, will do a request on
        // mount.
        authData: React.PropTypes.shape({
            flows: React.PropTypes.array,
            params: React.PropTypes.object,
            session: React.PropTypes.string,
        }),

        // callback
        makeRequest: React.PropTypes.func.isRequired,

        onFinished: React.PropTypes.func.isRequired,

        title: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            title: "Authentication",
        };
    },

    getInitialState: function() {
        return {
            authError: null,
        }
    },

    _onAuthFinished: function(success, result) {
        if (success) {
            this.props.onFinished(true);
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
                <div>
                    <div>{this.state.authError.message || this.state.authError.toString()}</div>
                    <br />
                    <AccessibleButton onClick={this._onDismissClick}
                        className="mx_UserSettings_button"
                    >
                        Dismiss
                    </AccessibleButton>
                </div>
            );
        } else {
            content = (
                <div>
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
                title={this.state.authError ? 'Error' : this.props.title}
            >
                {content}
            </BaseDialog>
        );
    },
});
