/*
Copyright 2015, 2016 OpenMarket Ltd
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

var React = require('react');

var sdk = require('../../../index');
var ServerConfig = require("../../views/login/ServerConfig");
var MatrixClientPeg = require("../../../MatrixClientPeg");
var RegistrationForm = require("../../views/login/RegistrationForm");
var CaptchaForm = require("../../views/login/CaptchaForm");
var RtsClient = require("../../../RtsClient");

var MIN_PASSWORD_LENGTH = 6;

/**
 * TODO: It would be nice to make use of the InteractiveAuthEntryComponents
 * here, rather than inventing our own.
 */
module.exports = React.createClass({
    displayName: 'Registration',

    propTypes: {
        onLoggedIn: React.PropTypes.func.isRequired,
        clientSecret: React.PropTypes.string,
        sessionId: React.PropTypes.string,
        makeRegistrationUrl: React.PropTypes.func,
        idSid: React.PropTypes.string,
        customHsUrl: React.PropTypes.string,
        customIsUrl: React.PropTypes.string,
        defaultHsUrl: React.PropTypes.string,
        defaultIsUrl: React.PropTypes.string,
        brand: React.PropTypes.string,
        email: React.PropTypes.string,
        referrer: React.PropTypes.string,
        username: React.PropTypes.string,
        guestAccessToken: React.PropTypes.string,
        teamServerConfig: React.PropTypes.shape({
            // Email address to request new teams
            supportEmail: React.PropTypes.string.isRequired,
            // URL of the riot-team-server to get team configurations and track referrals
            teamServerURL: React.PropTypes.string.isRequired,
        }),
        teamSelected: React.PropTypes.object,
        onTeamMemberRegistered: React.PropTypes.func.isRequired,

        defaultDeviceDisplayName: React.PropTypes.string,

        // registration shouldn't know or care how login is done.
        onLoginClick: React.PropTypes.func.isRequired,
        onCancelClick: React.PropTypes.func
    },

    getInitialState: function() {
        return {
            busy: false,
            teamServerBusy: false,
            errorText: null,
            // We remember the values entered by the user because
            // the registration form will be unmounted during the
            // course of registration, but if there's an error we
            // want to bring back the registration form with the
            // values the user entered still in it. We can keep
            // them in this component's state since this component
            // persist for the duration of the registration process.
            formVals: {
                email: this.props.email,
            },
            // true if we're waiting for the user to complete
            // user-interactive auth
            // If we've been given a session ID, we're resuming
            // straight back into UI auth
            doingUIAuth: Boolean(this.props.sessionId),
        };
    },

    componentWillMount: function() {
        this._unmounted = false;

        this._hsUrl = this.props.customHsUrl;
        this._isUrl = this.props.customIsUrl;
        this._replaceClient();

        if (
            this.props.teamServerConfig &&
            this.props.teamServerConfig.teamServerURL &&
            !this._rtsClient
        ) {
            this._rtsClient = new RtsClient(this.props.teamServerConfig.teamServerURL);

            this.setState({
                teamServerBusy: true,
            });
            // GET team configurations including domains, names and icons
            this._rtsClient.getTeamsConfig().then((data) => {
                const teamsConfig = {
                    teams: data,
                    supportEmail: this.props.teamServerConfig.supportEmail,
                };
                console.log('Setting teams config to ', teamsConfig);
                this.setState({
                    teamsConfig: teamsConfig,
                    teamServerBusy: false,
                });
            }, (err) => {
                console.error('Error retrieving config for teams', err);
                this.setState({
                    teamServerBusy: false,
                });
            });
        }
    },

    onHsUrlChanged: function(newHsUrl) {
        this._hsUrl = newHsUrl;
        this._replaceClient();
    },

    onIsUrlChanged: function(newIsUrl) {
        this._isUrl = newIsUrl;
        this._replaceClient();
    },

    _replaceClient: function() {
        this._matrixClient = Matrix.createClient({
            baseUrl: this._hsUrl,
            idBaseUrl: this._isUrl,
        });
    },

    onFormSubmit: function(formVals) {
        var self = this;
        this.setState({
            errorText: "",
            busy: true,
            formVals: formVals,
            doingUIAuth: true,
        });
    },

    _onRegistered: function(success, response) {
        this.setState({
            // we're still busy until we get unmounted: don't show the registration form again
            busy: true,
            doingUIAuth: false,
        });
        this.props.onLoggedIn({
            userId: response.user_id,
            deviceId: response.device_id,
            homeserverUrl: this._hsUrl,
            identityServerUrl: this._isUrl,
            accessToken: response.access_token,
        });

        // Done regardless of `teamSelected`. People registering with non-team emails
        // will just nop. The point of this being we might not have the email address
        // that the user registered with at this stage (depending on whether this
        // is the client they initiated registration).
        if (self._rtsClient) {
            // Track referral if self.props.referrer set, get team_token in order to
            // retrieve team config and see welcome page etc.
            self._rtsClient.trackReferral(
                self.props.referrer || '', // Default to empty string = not referred
                self.registerLogic.params.idSid,
                self.registerLogic.params.clientSecret
            ).then((data) => {
                const teamToken = data.team_token;
                // Store for use /w welcome pages
                window.localStorage.setItem('mx_team_token', teamToken);
                self.props.onTeamMemberRegistered(teamToken);

                self._rtsClient.getTeam(teamToken).then((team) => {
                    console.log(
                        `User successfully registered with team ${team.name}`
                    );
                    if (!team.rooms) {
                        return;
                    }
                    // Auto-join rooms
                    team.rooms.forEach((room) => {
                        if (room.auto_join && room.room_id) {
                            console.log(`Auto-joining ${room.room_id}`);
                            MatrixClientPeg.get().joinRoom(room.room_id);
                        }
                    });
                }, (err) => {
                    console.error('Error getting team config', err);
                });
            }, (err) => {
                console.error('Error tracking referral', err);
            });
        }

        // Set approipriate branding on the email pusher
        if (self.props.brand) {
            MatrixClientPeg.get().getPushers().done((resp)=>{
                var pushers = resp.pushers;
                for (var i = 0; i < pushers.length; ++i) {
                    if (pushers[i].kind == 'email') {
                        var emailPusher = pushers[i];
                        emailPusher.data = { brand: self.props.brand };
                        MatrixClientPeg.get().setPusher(emailPusher).done(() => {
                            console.log("Set email branding to " + self.props.brand);
                        }, (error) => {
                            console.error("Couldn't set email branding: " + error);
                        });
                    }
                }
            }, (error) => {
                console.error("Couldn't get pushers: " + error);
            });
        }
    },

    onFormValidationFailed: function(errCode) {
        var errMsg;
        switch (errCode) {
            case "RegistrationForm.ERR_PASSWORD_MISSING":
                errMsg = "Missing password.";
                break;
            case "RegistrationForm.ERR_PASSWORD_MISMATCH":
                errMsg = "Passwords don't match.";
                break;
            case "RegistrationForm.ERR_PASSWORD_LENGTH":
                errMsg = `Password too short (min ${MIN_PASSWORD_LENGTH}).`;
                break;
            case "RegistrationForm.ERR_EMAIL_INVALID":
                errMsg = "This doesn't look like a valid email address";
                break;
            case "RegistrationForm.ERR_USERNAME_INVALID":
                errMsg = "User names may only contain letters, numbers, dots, hyphens and underscores.";
                break;
            case "RegistrationForm.ERR_USERNAME_BLANK":
                errMsg = "You need to enter a user name";
                break;
            default:
                console.error("Unknown error code: %s", errCode);
                errMsg = "An unknown error occurred.";
                break;
        }
        this.setState({
            errorText: errMsg
        });
    },

    onTeamSelected: function(teamSelected) {
        if (!this._unmounted) {
            this.setState({ teamSelected });
        }
    },

    _makeRegisterRequest: function(auth) {
        let guestAccessToken = this.props.guestAccessToken;

        if (this.state.formVals.username !== this.props.username) {
            // don't try to upgrade if we changed our username
            guestAccessToken = null;
        }

        return this._matrixClient.register(
            this.state.formVals.username,
            this.state.formVals.password,
            undefined, // session id: included in the auth dict already
            auth,
            // Only send the bind_email param if we're sending username / pw params
            // (Since we need to send no params at all to use the ones saved in the
            // session).
            Boolean(this.state.formVals.username) || undefined,
            guestAccessToken,
        );
    },

    _getUIAuthInputs() {
        return {
            emailAddress: this.state.formVals.email,
            phoneCountry: this.state.formVals.phoneCountry,
            phoneNumber: this.state.formVals.phoneNumber,
        }
    },

    render: function() {
        const LoginHeader = sdk.getComponent('login.LoginHeader');
        const LoginFooter = sdk.getComponent('login.LoginFooter');
        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');
        const Spinner = sdk.getComponent("elements.Spinner");

        let registerBody;
        if (this.state.doingUIAuth) {
            registerBody = (
                <InteractiveAuth
                    matrixClient={this._matrixClient}
                    makeRequest={this._makeRegisterRequest}
                    onFinished={this._onRegistered}
                    inputs={this._getUIAuthInputs()}
                    makeRegistrationUrl={this.props.makeRegistrationUrl}
                    sessionId={this.props.sessionId}
                    clientSecret={this.props.clientSecret}
                    emailSid={this.props.idSid}
                    poll={true}
                />
            );
        } else if (this.state.busy || this.state.teamServerBusy) {
            registerBody = <Spinner />;
        } else {
            registerBody = (
                <RegistrationForm
                    defaultUsername={this.state.formVals.username}
                    defaultEmail={this.state.formVals.email}
                    defaultPassword={this.state.formVals.password}
                    teamsConfig={this.state.teamsConfig}
                    guestUsername={this.props.username}
                    minPasswordLength={MIN_PASSWORD_LENGTH}
                    onError={this.onFormValidationFailed}
                    onRegisterClick={this.onFormSubmit}
                    onTeamSelected={this.onTeamSelected}
                />
            );
        }

        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <LoginHeader
                        icon={this.state.teamSelected ?
                            this.props.teamServerConfig.teamServerURL + "/static/common/" +
                            this.state.teamSelected.domain + "/icon.png" :
                            null}
                    />
                    {registerBody}
                    <LoginFooter />
                </div>
            </div>
        );
    }
});
