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

        // callback called when the auth process has finished,
        // successfully or unsuccessfully.
        // @param {bool} status True if the operation requiring
        //     auth was completed sucessfully, false if canceled.
        // @param {object} result The result of the authenticated call
        //     if successful, otherwise the error object
        // @param {object} extra Additional information about the UI Auth
        //     process:
        //      * emailSid {string} If email auth was performed, the sid of
        //            the auth session.
        //      * clientSecret {string} The client secret used in auth
        //            sessions with the ID server.
        onAuthFinished: React.PropTypes.func.isRequired,

        // Inputs provided by the user to the auth process
        // and used by various stages. As passed to js-sdk
        // interactive-auth
        inputs: React.PropTypes.object,

        // As js-sdk interactive-auth
        makeRegistrationUrl: React.PropTypes.func,
        sessionId: React.PropTypes.string,
        clientSecret: React.PropTypes.string,
        emailSid: React.PropTypes.string,

        // If true, poll to see if the auth flow has been completed
        // out-of-band
        poll: React.PropTypes.bool,
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
            inputs: this.props.inputs,
            stateUpdated: this._authStateUpdated,
            matrixClient: this.props.matrixClient,
            sessionId: this.props.sessionId,
            clientSecret: this.props.clientSecret,
            emailSid: this.props.emailSid,
        });

        this._authLogic.attemptAuth().then((result) => {
            const extra = {
                emailSid: this._authLogic.getEmailSid(),
                clientSecret: this._authLogic.getClientSecret(),
            };
            this.props.onAuthFinished(true, result, extra);
        }).catch((error) => {
            this.props.onAuthFinished(false, error);
            console.error("Error during user-interactive auth:", error);
            if (this._unmounted) {
                return;
            }

            const msg = error.message || error.toString();
            this.setState({
                errorText: msg
            });
        }).done();

        this._intervalId = null;
        if (this.props.poll) {
            this._intervalId = setInterval(() => {
                this._authLogic.poll();
            }, 2000);
        }
    },

    componentWillUnmount: function() {
        this._unmounted = true;

        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
        }
    },

    _authStateUpdated: function(stageType, stageState) {
        const oldStage = this.state.authStage;
        this.setState({
            authStage: stageType,
            stageState: stageState,
            errorText: stageState.error,
        }, () => {
            if (oldStage != stageType) this._setFocus();
        });
    },

    _requestCallback: function(auth, background) {
        const makeRequestPromise = this.props.makeRequest(auth);

        // if it's a background request, just do it: we don't want
        // it to affect the state of our UI.
        if (background) return makeRequestPromise;

        // otherwise, manage the state of the spinner and error messages
        this.setState({
            busy: true,
            errorText: null,
            stageErrorText: null,
        });
        return makeRequestPromise.finally(() => {
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
        if (!stage) return null;

        const StageComponent = getEntryComponentForLoginType(stage);
        return (
            <StageComponent ref="stageComponent"
                loginType={stage}
                matrixClient={this.props.matrixClient}
                authSessionId={this._authLogic.getSessionId()}
                clientSecret={this._authLogic.getClientSecret()}
                stageParams={this._authLogic.getStageParams(stage)}
                submitAuthDict={this._submitAuthDict}
                errorText={this.state.stageErrorText}
                busy={this.state.busy}
                inputs={this.props.inputs}
                stageState={this.state.stageState}
                fail={this._onAuthStageFailed}
                setEmailSid={this._setEmailSid}
                makeRegistrationUrl={this.props.makeRegistrationUrl}
            />
        );
    },

    _onAuthStageFailed: function(e) {
        this.props.onAuthFinished(false, e);
    },
    _setEmailSid: function(sid) {
        this._authLogic.setEmailSid(sid);
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
