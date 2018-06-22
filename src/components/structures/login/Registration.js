/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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

import Promise from 'bluebird';
import React from 'react';
import PropTypes from 'prop-types';

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import RegistrationForm from '../../views/login/RegistrationForm';
import RtsClient from '../../../RtsClient';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import SettingsStore from "../../../settings/SettingsStore";

const MIN_PASSWORD_LENGTH = 6;

module.exports = React.createClass({
    displayName: 'Registration',

    propTypes: {
        onLoggedIn: PropTypes.func.isRequired,
        clientSecret: PropTypes.string,
        sessionId: PropTypes.string,
        makeRegistrationUrl: PropTypes.func.isRequired,
        idSid: PropTypes.string,
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,
        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        brand: PropTypes.string,
        email: PropTypes.string,
        referrer: PropTypes.string,
        teamServerConfig: PropTypes.shape({
            // Email address to request new teams
            supportEmail: PropTypes.string.isRequired,
            // URL of the riot-team-server to get team configurations and track referrals
            teamServerURL: PropTypes.string.isRequired,
        }),
        teamSelected: PropTypes.object,

        defaultDeviceDisplayName: PropTypes.string,

        // registration shouldn't know or care how login is done.
        onLoginClick: PropTypes.func.isRequired,
        onCancelClick: PropTypes.func,
        onServerConfigChange: PropTypes.func.isRequired,

        rtsClient: PropTypes.shape({
            getTeamsConfig: PropTypes.func.isRequired,
            trackReferral: PropTypes.func.isRequired,
            getTeam: PropTypes.func.isRequired,
        }),
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
            hsUrl: this.props.customHsUrl,
            isUrl: this.props.customIsUrl,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;

        this._replaceClient();

        if (
            this.props.teamServerConfig &&
            this.props.teamServerConfig.teamServerURL &&
            !this._rtsClient
        ) {
            this._rtsClient = this.props.rtsClient || new RtsClient(this.props.teamServerConfig.teamServerURL);

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

    onServerConfigChange: function(config) {
        const newState = {};
        if (config.hsUrl !== undefined) {
            newState.hsUrl = config.hsUrl;
        }
        if (config.isUrl !== undefined) {
            newState.isUrl = config.isUrl;
        }
        this.props.onServerConfigChange(config);
        this.setState(newState, () => {
            this._replaceClient();
        });
    },

    _replaceClient: function() {
        this._matrixClient = Matrix.createClient({
            baseUrl: this.state.hsUrl,
            idBaseUrl: this.state.isUrl,
        });
    },

    onFormSubmit: function(formVals) {
        this.setState({
            errorText: "",
            busy: true,
            formVals: formVals,
            doingUIAuth: true,
        });
    },

    _onUIAuthFinished: function(success, response, extra) {
        if (!success) {
            let msg = response.message || response.toString();
            // can we give a better error message?
            if (response.required_stages && response.required_stages.indexOf('m.login.msisdn') > -1) {
                let msisdnAvailable = false;
                for (const flow of response.available_flows) {
                    msisdnAvailable |= flow.stages.indexOf('m.login.msisdn') > -1;
                }
                if (!msisdnAvailable) {
                    msg = _t('This server does not support authentication with a phone number.');
                }
            }
            this.setState({
                busy: false,
                doingUIAuth: false,
                errorText: msg,
            });
            return;
        }

        this.setState({
            // we're still busy until we get unmounted: don't show the registration form again
            busy: true,
            doingUIAuth: false,
        });

        // Done regardless of `teamSelected`. People registering with non-team emails
        // will just nop. The point of this being we might not have the email address
        // that the user registered with at this stage (depending on whether this
        // is the client they initiated registration).
        let trackPromise = Promise.resolve(null);
        if (this._rtsClient && extra.emailSid) {
            // Track referral if this.props.referrer set, get team_token in order to
            // retrieve team config and see welcome page etc.
            trackPromise = this._rtsClient.trackReferral(
                this.props.referrer || '', // Default to empty string = not referred
                extra.emailSid,
                extra.clientSecret,
            ).then((data) => {
                const teamToken = data.team_token;
                // Store for use /w welcome pages
                window.localStorage.setItem('mx_team_token', teamToken);

                this._rtsClient.getTeam(teamToken).then((team) => {
                    console.log(
                        `User successfully registered with team ${team.name}`,
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

                return teamToken;
            }, (err) => {
                console.error('Error tracking referral', err);
            });
        }

        trackPromise.then((teamToken) => {
            return this.props.onLoggedIn({
                userId: response.user_id,
                deviceId: response.device_id,
                homeserverUrl: this._matrixClient.getHomeserverUrl(),
                identityServerUrl: this._matrixClient.getIdentityServerUrl(),
                accessToken: response.access_token,
            }, teamToken);
        }).then((cli) => {
            return this._setupPushers(cli);
        });
    },

    _setupPushers: function(matrixClient) {
        if (!this.props.brand) {
            return Promise.resolve();
        }
        return matrixClient.getPushers().then((resp)=>{
            const pushers = resp.pushers;
            for (let i = 0; i < pushers.length; ++i) {
                if (pushers[i].kind === 'email') {
                    const emailPusher = pushers[i];
                    emailPusher.data = { brand: this.props.brand };
                    matrixClient.setPusher(emailPusher).done(() => {
                        console.log("Set email branding to " + this.props.brand);
                    }, (error) => {
                        console.error("Couldn't set email branding: " + error);
                    });
                }
            }
        }, (error) => {
            console.error("Couldn't get pushers: " + error);
        });
    },

    onFormValidationFailed: function(errCode) {
        let errMsg;
        switch (errCode) {
            case "RegistrationForm.ERR_PASSWORD_MISSING":
                errMsg = _t('Missing password.');
                break;
            case "RegistrationForm.ERR_PASSWORD_MISMATCH":
                errMsg = _t('Passwords don\'t match.');
                break;
            case "RegistrationForm.ERR_PASSWORD_LENGTH":
                errMsg = _t('Password too short (min %(MIN_PASSWORD_LENGTH)s).', {MIN_PASSWORD_LENGTH});
                break;
            case "RegistrationForm.ERR_EMAIL_INVALID":
                errMsg = _t('This doesn\'t look like a valid email address.');
                break;
            case "RegistrationForm.ERR_PHONE_NUMBER_INVALID":
                errMsg = _t('This doesn\'t look like a valid phone number.');
                break;
            case "RegistrationForm.ERR_USERNAME_INVALID":
                errMsg = _t('User names may only contain letters, numbers, dots, hyphens and underscores.');
                break;
            case "RegistrationForm.ERR_USERNAME_BLANK":
                errMsg = _t('You need to enter a user name.');
                break;
            default:
                console.error("Unknown error code: %s", errCode);
                errMsg = _t('An unknown error occurred.');
                break;
        }
        this.setState({
            errorText: errMsg,
        });
    },

    onTeamSelected: function(teamSelected) {
        if (!this._unmounted) {
            this.setState({ teamSelected });
        }
    },

    _makeRegisterRequest: function(auth) {
        // Only send the bind params if we're sending username / pw params
        // (Since we need to send no params at all to use the ones saved in the
        // session).
        const bindThreepids = this.state.formVals.password ? {
            email: true,
            msisdn: true,
        } : {};

        return this._matrixClient.register(
            this.state.formVals.username,
            this.state.formVals.password,
            undefined, // session id: included in the auth dict already
            auth,
            bindThreepids,
            null,
        );
    },

    _getUIAuthInputs: function() {
        return {
            emailAddress: this.state.formVals.email,
            phoneCountry: this.state.formVals.phoneCountry,
            phoneNumber: this.state.formVals.phoneNumber,
        };
    },

    render: function() {
        const LoginHeader = sdk.getComponent('login.LoginHeader');
        const LoginFooter = sdk.getComponent('login.LoginFooter');
        const LoginPage = sdk.getComponent('login.LoginPage');
        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');
        const Spinner = sdk.getComponent("elements.Spinner");
        const ServerConfig = sdk.getComponent('views.login.ServerConfig');

        const theme = SettingsStore.getValue("theme");

        let registerBody;
        if (this.state.doingUIAuth) {
            registerBody = (
                <InteractiveAuth
                    matrixClient={this._matrixClient}
                    makeRequest={this._makeRegisterRequest}
                    onAuthFinished={this._onUIAuthFinished}
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
            let serverConfigSection;
            if (!SdkConfig.get()['disable_custom_urls']) {
                serverConfigSection = (
                    <ServerConfig ref="serverConfig"
                        withToggleButton={true}
                        customHsUrl={this.props.customHsUrl}
                        customIsUrl={this.props.customIsUrl}
                        defaultHsUrl={this.props.defaultHsUrl}
                        defaultIsUrl={this.props.defaultIsUrl}
                        onServerConfigChange={this.onServerConfigChange}
                        delayTimeMs={1000}
                    />
                );
            }
            registerBody = (
                <div>
                    <RegistrationForm
                        defaultUsername={this.state.formVals.username}
                        defaultEmail={this.state.formVals.email}
                        defaultPhoneCountry={this.state.formVals.phoneCountry}
                        defaultPhoneNumber={this.state.formVals.phoneNumber}
                        defaultPassword={this.state.formVals.password}
                        teamsConfig={this.state.teamsConfig}
                        minPasswordLength={MIN_PASSWORD_LENGTH}
                        onError={this.onFormValidationFailed}
                        onRegisterClick={this.onFormSubmit}
                        onTeamSelected={this.onTeamSelected}
                    />
                    { serverConfigSection }
                </div>
            );
        }

        let header;
        let errorText;
        // FIXME: remove hardcoded Status team tweaks at some point
        if (theme === 'status' && this.state.errorText) {
            header = <div className="mx_Login_error">{ this.state.errorText }</div>;
        } else {
            header = <h2>{ _t('Create an account') }</h2>;
            if (this.state.errorText) {
                errorText = <div className="mx_Login_error">{ this.state.errorText }</div>;
            }
        }

        let signIn;
        if (!this.state.doingUIAuth) {
            signIn = (
                <a className="mx_Login_create" onClick={this.props.onLoginClick} href="#">
                    { theme === 'status' ? _t('Sign in') : _t('I already have an account') }
                </a>
            );
        }

        const LanguageSelector = sdk.getComponent('structures.login.LanguageSelector');

        return (
            <LoginPage>
                <div className="mx_Login_box">
                    <LoginHeader
                        icon={this.state.teamSelected ?
                            this.props.teamServerConfig.teamServerURL + "/static/common/" +
                            this.state.teamSelected.domain + "/icon.png" :
                            null}
                    />
                    { header }
                    { registerBody }
                    { signIn }
                    { errorText }
                    <LanguageSelector />
                    <LoginFooter />
                </div>
            </LoginPage>
        );
    },
});
