/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

var React = require('react');

var sdk = require('../../../index');
var dis = require('../../../dispatcher');
var Signup = require("../../../Signup");
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
        registrationUrl: React.PropTypes.string,
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
        teamSelected: null,

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
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this.dispatcherRef = dis.register(this.onAction);
        // attach this to the instance rather than this.state since it isn't UI
        this.registerLogic = new Signup.Register(
            this.props.customHsUrl, this.props.customIsUrl, {
                defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
            }
        );
        this.registerLogic.setClientSecret(this.props.clientSecret);
        this.registerLogic.setSessionId(this.props.sessionId);
        this.registerLogic.setRegistrationUrl(this.props.registrationUrl);
        this.registerLogic.setIdSid(this.props.idSid);
        this.registerLogic.setGuestAccessToken(this.props.guestAccessToken);
        this.registerLogic.recheckState();

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
            this._rtsClient.getTeamsConfig().then((args) => {
                // args = [$request, $body]
                const teamsConfig = {
                    teams: args[1],
                    supportEmail: this.props.teamServerConfig.supportEmail,
                };
                console.log('Setting teams config to ', teamsConfig);
                this.setState({
                    teamsConfig: teamsConfig,
                });
            }, (err) => {
                console.error('Error retrieving config for teams', err);
            }).finally(() => {
                this.setState({
                    teamServerBusy: false,
                });
            }).done();
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        this._unmounted = true;
    },

    componentDidMount: function() {
        // may have already done an HTTP hit (e.g. redirect from an email) so
        // check for any pending response
        var promise = this.registerLogic.getPromise();
        if (promise) {
            this.onProcessingRegistration(promise);
        }
    },

    onHsUrlChanged: function(newHsUrl) {
        this.registerLogic.setHomeserverUrl(newHsUrl);
    },

    onIsUrlChanged: function(newIsUrl) {
        this.registerLogic.setIdentityServerUrl(newIsUrl);
    },

    onAction: function(payload) {
        if (payload.action !== "registration_step_update") {
            return;
        }
        // If the registration state has changed, this means the
        // user now needs to do something. It would be better
        // to expose the explicitly in the register logic.
        this.setState({
            busy: false
        });
    },

    onFormSubmit: function(formVals) {
        var self = this;
        this.setState({
            errorText: "",
            busy: true,
            formVals: formVals,
        });

        if (formVals.username !== this.props.username) {
            // don't try to upgrade if we changed our username
            this.registerLogic.setGuestAccessToken(null);
        }

        this.onProcessingRegistration(this.registerLogic.register(formVals));
    },

    // Promise is resolved when the registration process is FULLY COMPLETE
    onProcessingRegistration: function(promise) {
        var self = this;
        promise.done(function(response) {
            self.setState({
                busy: false
            });
            if (!response || !response.access_token) {
                console.warn(
                    "FIXME: Register fulfilled without a final response, " +
                    "did you break the promise chain?"
                );
                // no matter, we'll grab it direct
                response = self.registerLogic.getCredentials();
            }
            if (!response || !response.user_id || !response.access_token) {
                console.error("Final response is missing keys.");
                self.setState({
                    errorText: "Registration failed on server"
                });
                return;
            }
            self.props.onLoggedIn({
                userId: response.user_id,
                deviceId: response.device_id,
                homeserverUrl: self.registerLogic.getHomeserverUrl(),
                identityServerUrl: self.registerLogic.getIdentityServerUrl(),
                accessToken: response.access_token
            });

            if (
                self._rtsClient &&
                self.props.referrer &&
                self.state.teamSelected
            ) {
                // Track referral, get team_token in order to retrieve team config
                self._rtsClient.trackReferral(
                    self.props.referrer,
                    response.user_id,
                    self.state.formVals.email
                ).then((args) => {
                    const teamToken = args[1].team_token;
                    // Store for use /w welcome pages
                    window.localStorage.setItem('mx_team_token', teamToken);

                    self._rtsClient.getTeam(teamToken).then((args) => {
                        const team = args[1];
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

        }, function(err) {
            if (err.message) {
                self.setState({
                    errorText: err.message
                });
            }
            self.setState({
                busy: false
            });
            console.log(err);
        });
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

    onCaptchaResponse: function(response) {
        this.registerLogic.tellStage("m.login.recaptcha", {
            response: response
        });
    },

    onTeamSelected: function(teamSelected) {
        if (!this._unmounted) {
            this.setState({ teamSelected });
        }
    },

    _getRegisterContentJsx: function() {
        const Spinner = sdk.getComponent("elements.Spinner");

        var currStep = this.registerLogic.getStep();
        var registerStep;
        switch (currStep) {
            case "Register.COMPLETE":
                break; // NOP
            case "Register.START":
            case "Register.STEP_m.login.dummy":
                // NB. Our 'username' prop is specifically for upgrading
                // a guest account
                if (this.state.teamServerBusy) {
                    registerStep = <Spinner />;
                    break;
                }
                registerStep = (
                    <RegistrationForm
                        showEmail={true}
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
                break;
            case "Register.STEP_m.login.email.identity":
                registerStep = (
                    <div>
                        Please check your email to continue registration.
                    </div>
                );
                break;
            case "Register.STEP_m.login.recaptcha":
                var publicKey;
                var serverParams = this.registerLogic.getServerData().params;
                if (serverParams && serverParams["m.login.recaptcha"]) {
                    publicKey = serverParams["m.login.recaptcha"].public_key;
                }

                registerStep = (
                    <CaptchaForm sitePublicKey={publicKey}
                        onCaptchaResponse={this.onCaptchaResponse}
                    />
                );
                break;
            default:
                console.error("Unknown register state: %s", currStep);
                break;
        }
        var busySpinner;
        if (this.state.busy) {
            busySpinner = (
                <Spinner />
            );
        }

        var returnToAppJsx;
        if (this.props.onCancelClick) {
            returnToAppJsx =
                <a className="mx_Login_create" onClick={this.props.onCancelClick} href="#">
                    Return to app
                </a>;
        }

        return (
            <div>
                <h2>Create an account</h2>
                {registerStep}
                <div className="mx_Login_error">{this.state.errorText}</div>
                {busySpinner}
                <ServerConfig ref="serverConfig"
                    withToggleButton={ this.registerLogic.getStep() === "Register.START" }
                    customHsUrl={this.props.customHsUrl}
                    customIsUrl={this.props.customIsUrl}
                    defaultHsUrl={this.props.defaultHsUrl}
                    defaultIsUrl={this.props.defaultIsUrl}
                    onHsUrlChanged={this.onHsUrlChanged}
                    onIsUrlChanged={this.onIsUrlChanged}
                    delayTimeMs={1000} />
                <div className="mx_Login_error">
                </div>
                <a className="mx_Login_create" onClick={this.props.onLoginClick} href="#">
                    I already have an account
                </a>
                { returnToAppJsx }
            </div>
        );
    },

    render: function() {
        var LoginHeader = sdk.getComponent('login.LoginHeader');
        var LoginFooter = sdk.getComponent('login.LoginFooter');
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <LoginHeader icon={this.state.teamSelected ? this.state.teamSelected.icon : null}/>
                    {this._getRegisterContentJsx()}
                    <LoginFooter />
                </div>
            </div>
        );
    }
});
