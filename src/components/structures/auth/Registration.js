/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd

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
import { _t, _td } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import { messageForResourceLimitError } from '../../../utils/ErrorUtils';
import * as ServerType from '../../views/auth/ServerTypeSelector';

const MIN_PASSWORD_LENGTH = 6;

// Phases
// Show controls to configure server details
const PHASE_SERVER_DETAILS = 0;
// Show the appropriate registration flow(s) for the server
const PHASE_REGISTRATION = 1;

// Enable phases for registration
const PHASES_ENABLED = true;

module.exports = React.createClass({
    displayName: 'Registration',

    propTypes: {
        onLoggedIn: PropTypes.func.isRequired,
        clientSecret: PropTypes.string,
        sessionId: PropTypes.string,
        makeRegistrationUrl: PropTypes.func.isRequired,
        idSid: PropTypes.string,
        // The default server name to use when the user hasn't specified
        // one. If set, `defaultHsUrl` and `defaultHsUrl` were derived for this
        // via `.well-known` discovery. The server name is used instead of the
        // HS URL when talking about "your account".
        defaultServerName: PropTypes.string,
        // An error passed along from higher up explaining that something
        // went wrong when finding the defaultHsUrl.
        defaultServerDiscoveryError: PropTypes.string,
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,
        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        skipServerDetails: PropTypes.bool,
        brand: PropTypes.string,
        email: PropTypes.string,
        // registration shouldn't know or care how login is done.
        onLoginClick: PropTypes.func.isRequired,
        onServerConfigChange: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        const serverType = ServerType.getTypeFromHsUrl(this.props.customHsUrl);

        const customURLsAllowed = !SdkConfig.get()['disable_custom_urls'];
        let initialPhase = this.getDefaultPhaseForServerType(serverType);
        if (
            // if we have these two, skip to the good bit
            // (they could come in from the URL params in a
            // registration email link)
            (this.props.clientSecret && this.props.sessionId) ||
            // if custom URLs aren't allowed, skip to form
            !customURLsAllowed ||
            // if other logic says to, skip to form
            this.props.skipServerDetails
        ) {
            // TODO: It would seem we've now added enough conditions here that the initial
            // phase will _always_ be the form. It's tempting to remove the complexity and
            // just do that, but we keep tweaking and changing auth, so let's wait until
            // things settle a bit.
            // Filed https://github.com/vector-im/riot-web/issues/8886 to track this.
            initialPhase = PHASE_REGISTRATION;
        }

        return {
            busy: false,
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
            serverType,
            hsUrl: this.props.customHsUrl,
            isUrl: this.props.customIsUrl,
            // Phase of the overall registration dialog.
            phase: initialPhase,
            flows: null,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this._replaceClient();
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

    getDefaultPhaseForServerType(type) {
        switch (type) {
            case ServerType.FREE: {
                // Move directly to the registration phase since the server
                // details are fixed.
                return PHASE_REGISTRATION;
            }
            case ServerType.PREMIUM:
            case ServerType.ADVANCED:
                return PHASE_SERVER_DETAILS;
        }
    },

    onServerTypeChange(type) {
        this.setState({
            serverType: type,
        });

        // When changing server types, set the HS / IS URLs to reasonable defaults for the
        // the new type.
        switch (type) {
            case ServerType.FREE: {
                const { hsUrl, isUrl } = ServerType.TYPES.FREE;
                this.onServerConfigChange({
                    hsUrl,
                    isUrl,
                });
                break;
            }
            case ServerType.PREMIUM:
            case ServerType.ADVANCED:
                this.onServerConfigChange({
                    hsUrl: this.props.defaultHsUrl,
                    isUrl: this.props.defaultIsUrl,
                });
                break;
        }

        // Reset the phase to default phase for the server type.
        this.setState({
            phase: this.getDefaultPhaseForServerType(type),
        });
    },

    _replaceClient: async function() {
        this.setState({
            errorText: null,
        });
        this._matrixClient = Matrix.createClient({
            baseUrl: this.state.hsUrl,
            idBaseUrl: this.state.isUrl,
        });
        try {
            await this._makeRegisterRequest({});
            // This should never succeed since we specified an empty
            // auth object.
            console.log("Expecting 401 from register request but got success!");
        } catch (e) {
            if (e.httpStatus === 401) {
                this.setState({
                    flows: e.data.flows,
                });
            } else if (e.httpStatus === 403 && e.errcode === "M_UNKNOWN") {
                this.setState({
                    errorText: _t("Registration has been disabled on this homeserver."),
                });
            } else {
                this.setState({
                    errorText: _t("Unable to query for supported registration methods."),
                });
            }
        }
    },

    onFormSubmit: function(formVals) {
        // Don't allow the user to register if there's a discovery error
        // Without this, the user could end up registering on the wrong homeserver.
        if (this.props.defaultServerDiscoveryError) {
            this.setState({errorText: this.props.defaultServerDiscoveryError});
            return;
        }
        this.setState({
            errorText: "",
            busy: true,
            formVals: formVals,
            doingUIAuth: true,
        });
    },

    _onUIAuthFinished: async function(success, response, extra) {
        if (!success) {
            let msg = response.message || response.toString();
            // can we give a better error message?
            if (response.errcode == 'M_RESOURCE_LIMIT_EXCEEDED') {
                const errorTop = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact, {
                    'monthly_active_user': _td(
                        "This homeserver has hit its Monthly Active User limit.",
                    ),
                    '': _td(
                        "This homeserver has exceeded one of its resource limits.",
                    ),
                });
                const errorDetail = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact, {
                    '': _td(
                        "Please <a>contact your service administrator</a> to continue using this service.",
                    ),
                });
                msg = <div>
                    <p>{errorTop}</p>
                    <p>{errorDetail}</p>
                </div>;
            } else if (response.required_stages && response.required_stages.indexOf('m.login.msisdn') > -1) {
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

        const cli = await this.props.onLoggedIn({
            userId: response.user_id,
            deviceId: response.device_id,
            homeserverUrl: this._matrixClient.getHomeserverUrl(),
            identityServerUrl: this._matrixClient.getIdentityServerUrl(),
            accessToken: response.access_token,
        });

        this._setupPushers(cli);
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

    onFormValidationChange: function(fieldErrors) {
        // `fieldErrors` is an object mapping field IDs to error codes when there is an
        // error or `null` for no error, so the values array will be something like:
        // `[ null, "RegistrationForm.ERR_PASSWORD_MISSING", null]`
        // Find the first non-null error code and show that.
        const errCode = Object.values(fieldErrors).find(value => !!value);
        if (!errCode) {
            this.setState({
                errorText: null,
            });
            return;
        }

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
            case "RegistrationForm.ERR_MISSING_EMAIL":
                errMsg = _t('An email address is required to register on this homeserver.');
                break;
            case "RegistrationForm.ERR_MISSING_PHONE_NUMBER":
                errMsg = _t('A phone number is required to register on this homeserver.');
                break;
            case "RegistrationForm.ERR_USERNAME_INVALID":
                errMsg = _t("A username can only contain lower case letters, numbers and '=_-./'");
                break;
            case "RegistrationForm.ERR_USERNAME_BLANK":
                errMsg = _t('You need to enter a username.');
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

    onLoginClick: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onLoginClick();
    },

    onServerDetailsNextPhaseClick(ev) {
        ev.stopPropagation();
        this.setState({
            phase: PHASE_REGISTRATION,
        });
    },

    onEditServerDetailsClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            phase: PHASE_SERVER_DETAILS,
        });
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

    renderServerComponent() {
        const ServerTypeSelector = sdk.getComponent("auth.ServerTypeSelector");
        const ServerConfig = sdk.getComponent("auth.ServerConfig");
        const ModularServerConfig = sdk.getComponent("auth.ModularServerConfig");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        if (SdkConfig.get()['disable_custom_urls']) {
            return null;
        }

        // If we're on a different phase, we only show the server type selector,
        // which is always shown if we allow custom URLs at all.
        if (PHASES_ENABLED && this.state.phase !== PHASE_SERVER_DETAILS) {
            return <div>
                <ServerTypeSelector
                    selected={this.state.serverType}
                    onChange={this.onServerTypeChange}
                />
            </div>;
        }

        let serverDetails = null;
        switch (this.state.serverType) {
            case ServerType.FREE:
                break;
            case ServerType.PREMIUM:
                serverDetails = <ModularServerConfig
                    customHsUrl={this.state.discoveredHsUrl || this.props.customHsUrl}
                    defaultHsUrl={this.props.defaultHsUrl}
                    defaultIsUrl={this.props.defaultIsUrl}
                    onServerConfigChange={this.onServerConfigChange}
                    delayTimeMs={250}
                />;
                break;
            case ServerType.ADVANCED:
                serverDetails = <ServerConfig
                    customHsUrl={this.state.discoveredHsUrl || this.props.customHsUrl}
                    customIsUrl={this.state.discoveredIsUrl || this.props.customIsUrl}
                    defaultHsUrl={this.props.defaultHsUrl}
                    defaultIsUrl={this.props.defaultIsUrl}
                    onServerConfigChange={this.onServerConfigChange}
                    delayTimeMs={250}
                />;
                break;
        }

        let nextButton = null;
        if (PHASES_ENABLED) {
            nextButton = <AccessibleButton className="mx_Login_submit"
                onClick={this.onServerDetailsNextPhaseClick}
            >
                {_t("Next")}
            </AccessibleButton>;
        }

        return <div>
            <ServerTypeSelector
                selected={this.state.serverType}
                onChange={this.onServerTypeChange}
            />
            {serverDetails}
            {nextButton}
        </div>;
    },

    renderRegisterComponent() {
        if (PHASES_ENABLED && this.state.phase !== PHASE_REGISTRATION) {
            return null;
        }

        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');
        const Spinner = sdk.getComponent('elements.Spinner');
        const RegistrationForm = sdk.getComponent('auth.RegistrationForm');

        if (this.state.doingUIAuth) {
            return <InteractiveAuth
                matrixClient={this._matrixClient}
                makeRequest={this._makeRegisterRequest}
                onAuthFinished={this._onUIAuthFinished}
                inputs={this._getUIAuthInputs()}
                makeRegistrationUrl={this.props.makeRegistrationUrl}
                sessionId={this.props.sessionId}
                clientSecret={this.props.clientSecret}
                emailSid={this.props.idSid}
                poll={true}
            />;
        } else if (this.state.busy || !this.state.flows) {
            return <div className="mx_AuthBody_spinner">
                <Spinner />
            </div>;
        } else {
            let onEditServerDetailsClick = null;
            // If custom URLs are allowed and we haven't selected the Free server type, wire
            // up the server details edit link.
            if (
                PHASES_ENABLED &&
                !SdkConfig.get()['disable_custom_urls'] &&
                this.state.serverType !== ServerType.FREE
            ) {
                onEditServerDetailsClick = this.onEditServerDetailsClick;
            }

            // If the current HS URL is the default HS URL, then we can label it
            // with the default HS name (if it exists).
            let hsName;
            if (this.state.hsUrl === this.props.defaultHsUrl) {
                hsName = this.props.defaultServerName;
            }

            return <RegistrationForm
                defaultUsername={this.state.formVals.username}
                defaultEmail={this.state.formVals.email}
                defaultPhoneCountry={this.state.formVals.phoneCountry}
                defaultPhoneNumber={this.state.formVals.phoneNumber}
                defaultPassword={this.state.formVals.password}
                minPasswordLength={MIN_PASSWORD_LENGTH}
                onValidationChange={this.onFormValidationChange}
                onRegisterClick={this.onFormSubmit}
                onEditServerDetailsClick={onEditServerDetailsClick}
                flows={this.state.flows}
                hsName={hsName}
                hsUrl={this.state.hsUrl}
            />;
        }
    },

    render: function() {
        const AuthHeader = sdk.getComponent('auth.AuthHeader');
        const AuthBody = sdk.getComponent("auth.AuthBody");
        const AuthPage = sdk.getComponent('auth.AuthPage');

        let errorText;
        const err = this.state.errorText || this.props.defaultServerDiscoveryError;
        if (err) {
            errorText = <div className="mx_Login_error">{ err }</div>;
        }

        const signIn = <a className="mx_AuthBody_changeFlow" onClick={this.onLoginClick} href="#">
            { _t('Sign in instead') }
        </a>;

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2>{ _t('Create your account') }</h2>
                    { errorText }
                    { this.renderServerComponent() }
                    { this.renderRegisterComponent() }
                    { signIn }
                </AuthBody>
            </AuthPage>
        );
    },
});
