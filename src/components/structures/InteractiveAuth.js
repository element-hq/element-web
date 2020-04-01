/*
Copyright 2017 Vector Creations Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {InteractiveAuth} from "matrix-js-sdk";
import React, {createRef} from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

import getEntryComponentForLoginType from '../views/auth/InteractiveAuthEntryComponents';

import * as sdk from '../../index';

export const ERROR_USER_CANCELLED = new Error("User cancelled auth session");

export default createReactClass({
    displayName: 'InteractiveAuth',

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

        // callback called when the auth process has finished,
        // successfully or unsuccessfully.
        // @param {bool} status True if the operation requiring
        //     auth was completed sucessfully, false if canceled.
        // @param {object} result The result of the authenticated call
        //     if successful, otherwise the error object.
        // @param {object} extra Additional information about the UI Auth
        //     process:
        //      * emailSid {string} If email auth was performed, the sid of
        //            the auth session.
        //      * clientSecret {string} The client secret used in auth
        //            sessions with the ID server.
        onAuthFinished: PropTypes.func.isRequired,

        // Inputs provided by the user to the auth process
        // and used by various stages. As passed to js-sdk
        // interactive-auth
        inputs: PropTypes.object,

        // As js-sdk interactive-auth
        requestEmailToken: PropTypes.func,
        sessionId: PropTypes.string,
        clientSecret: PropTypes.string,
        emailSid: PropTypes.string,

        // If true, poll to see if the auth flow has been completed
        // out-of-band
        poll: PropTypes.bool,

        // If true, components will be told that the 'Continue' button
        // is managed by some other party and should not be managed by
        // the component itself.
        continueIsManaged: PropTypes.bool,

        // Called when the stage changes, or the stage's phase changes. First
        // argument is the stage, second is the phase. Some stages do not have
        // phases and will be counted as 0 (numeric).
        onStagePhaseChange: PropTypes.func,

        // continueText and continueKind are passed straight through to the AuthEntryComponent.
        continueText: PropTypes.string,
        continueKind: PropTypes.string,
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

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        this._unmounted = false;
        this._authLogic = new InteractiveAuth({
            authData: this.props.authData,
            doRequest: this._requestCallback,
            busyChanged: this._onBusyChanged,
            inputs: this.props.inputs,
            stateUpdated: this._authStateUpdated,
            matrixClient: this.props.matrixClient,
            sessionId: this.props.sessionId,
            clientSecret: this.props.clientSecret,
            emailSid: this.props.emailSid,
            requestEmailToken: this._requestEmailToken,
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
                errorText: msg,
            });
        });

        this._intervalId = null;
        if (this.props.poll) {
            this._intervalId = setInterval(() => {
                this._authLogic.poll();
            }, 2000);
        }

        this._stageComponent = createRef();
    },

    componentWillUnmount: function() {
        this._unmounted = true;

        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
        }
    },

    _requestEmailToken: async function(...args) {
        this.setState({
            busy: true,
        });
        try {
            return await this.props.requestEmailToken(...args);
        } finally {
            this.setState({
                busy: false,
            });
        }
    },

    tryContinue: function() {
        if (this._stageComponent.current && this._stageComponent.current.tryContinue) {
            this._stageComponent.current.tryContinue();
        }
    },

    _authStateUpdated: function(stageType, stageState) {
        const oldStage = this.state.authStage;
        this.setState({
            busy: false,
            authStage: stageType,
            stageState: stageState,
            errorText: stageState.error,
        }, () => {
            if (oldStage != stageType) this._setFocus();
        });
    },

    _requestCallback: function(auth) {
        // This wrapper just exists because the js-sdk passes a second
        // 'busy' param for backwards compat. This throws the tests off
        // so discard it here.
        return this.props.makeRequest(auth);
    },

    _onBusyChanged: function(busy) {
        // if we've started doing stuff, reset the error messages
        if (busy) {
            this.setState({
                busy: true,
                errorText: null,
                stageErrorText: null,
            });
        }
        // The JS SDK eagerly reports itself as "not busy" right after any
        // immediate work has completed, but that's not really what we want at
        // the UI layer, so we ignore this signal and show a spinner until
        // there's a new screen to show the user. This is implemented by setting
        // `busy: false` in `_authStateUpdated`.
        // See also https://github.com/vector-im/riot-web/issues/12546
    },

    _setFocus: function() {
        if (this._stageComponent.current && this._stageComponent.current.focus) {
            this._stageComponent.current.focus();
        }
    },

    _submitAuthDict: function(authData) {
        this._authLogic.submitAuthDict(authData);
    },

    _onPhaseChange: function(newPhase) {
        if (this.props.onStagePhaseChange) {
            this.props.onStagePhaseChange(this.state.authStage, newPhase || 0);
        }
    },

    _onStageCancel: function() {
        this.props.onAuthFinished(false, ERROR_USER_CANCELLED);
    },

    _renderCurrentStage: function() {
        const stage = this.state.authStage;
        if (!stage) {
            if (this.state.busy) {
                const Loader = sdk.getComponent("elements.Spinner");
                return <Loader />;
            } else {
                return null;
            }
        }

        const StageComponent = getEntryComponentForLoginType(stage);
        return (
            <StageComponent
                ref={this._stageComponent}
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
                showContinue={!this.props.continueIsManaged}
                onPhaseChange={this._onPhaseChange}
                continueText={this.props.continueText}
                continueKind={this.props.continueKind}
                onCancel={this._onStageCancel}
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
                    { this.state.errorText }
                </div>
            );
        }

        return (
            <div>
                <div>
                    { this._renderCurrentStage() }
                    { error }
                </div>
            </div>
        );
    },
});
