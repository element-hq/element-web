/*
Copyright 2017 Vector Creations Ltd.

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
const InteractiveAuth = Matrix.InteractiveAuth;

import React from 'react';

import sdk from '../../index';

import {getEntryComponentForLoginType} from '../views/login/InteractiveAuthEntryComponents';

export default React.createClass({
    displayName: 'InteractiveAuth',

    propTypes: {
        // response from initial request. If not supplied, will do a request on
        // mount.
        authData: React.PropTypes.shape({
            flows: React.PropTypes.array,
            params: React.PropTypes.object,
            session: React.PropTypes.string,
        }),

        // callback
        makeRequest: React.PropTypes.func.isRequired,

        // callback called when the auth process has finished
        // @param {bool} status True if the operation requiring
        //     auth was completed sucessfully, false if canceled.
        // @param result The result of the authenticated call
        onFinished: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            authStage: null,
            busy: false,
            errorText: null,
            stageErrorText: null,
            submitButtonEnabled: false,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this._authLogic = new InteractiveAuth({
            authData: this.props.authData,
            doRequest: this._requestCallback,
            startAuthStage: this._startAuthStage,
        });

        this._authLogic.attemptAuth().then((result) => {
            this.props.onFinished(true, result);
        }).catch((error) => {
            console.error("Error during user-interactive auth:", error);
            if (this._unmounted) {
                return;
            }

            const msg = error.message || error.toString();
            this.setState({
                errorText: msg
            });
        }).done();
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _startAuthStage: function(stageType, error) {
        this.setState({
            authStage: stageType,
            errorText: error ? error.error : null,
        }, this._setFocus);
    },

    _requestCallback: function(auth) {
        this.setState({
            busy: true,
            errorText: null,
            stageErrorText: null,
        });
        return this.props.makeRequest(auth).finally(() => {
            if (this._unmounted) {
                return;
            }
            this.setState({
                busy: false,
            });
        });
    },

    _setFocus: function() {
        if (this.refs.stageComponent && this.refs.stageComponent.focus) {
            this.refs.stageComponent.focus();
        }
    },

    _submitAuthDict: function(authData) {
        this._authLogic.submitAuthDict(authData);
    },

    _renderCurrentStage: function() {
        const stage = this.state.authStage;
        var StageComponent = getEntryComponentForLoginType(stage);
        return (
            <StageComponent ref="stageComponent"
                loginType={stage}
                authSessionId={this._authLogic.getSessionId()}
                stageParams={this._authLogic.getStageParams(stage)}
                submitAuthDict={this._submitAuthDict}
                errorText={this.state.stageErrorText}
                busy={this.state.busy}
            />
        );
    },

    render: function() {
        let error = null;
        if (this.state.errorText) {
            error = (
                <div className="error">
                    {this.state.errorText}
                </div>
            );
        }

        return (
            <div>
                <div>
                    {this._renderCurrentStage()}
                    {error}
                </div>
            </div>
        );
    },
});
