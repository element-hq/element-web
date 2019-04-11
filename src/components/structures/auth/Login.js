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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { _t, _td } from '../../../languageHandler';
import sdk from '../../../index';
import Login from '../../../Login';
import SdkConfig from '../../../SdkConfig';
import { messageForResourceLimitError } from '../../../utils/ErrorUtils';
import { AutoDiscovery } from "matrix-js-sdk";

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

// Phases
// Show controls to configure server details
const PHASE_SERVER_DETAILS = 0;
// Show the appropriate login flow(s) for the server
const PHASE_LOGIN = 1;

// Enable phases for login
const PHASES_ENABLED = true;

// These are used in several places, and come from the js-sdk's autodiscovery
// stuff. We define them here so that they'll be picked up by i18n.
_td("Invalid homeserver discovery response");
_td("Failed to get autodiscovery configuration from server");
_td("Invalid base_url for m.homeserver");
_td("Homeserver URL does not appear to be a valid Matrix homeserver");
_td("Invalid identity server discovery response");
_td("Invalid base_url for m.identity_server");
_td("Identity server URL does not appear to be a valid identity server");
_td("General failure");

/**
 * A wire component which glues together login UI components and Login logic
 */
module.exports = React.createClass({
    displayName: 'Login',

    propTypes: {
        onLoggedIn: PropTypes.func.isRequired,

        // The default server name to use when the user hasn't specified
        // one. If set, `defaultHsUrl` and `defaultHsUrl` were derived for this
        // via `.well-known` discovery. The server name is used instead of the
        // HS URL when talking about where to "sign in to".
        defaultServerName: PropTypes.string,
        // An error passed along from higher up explaining that something
        // went wrong when finding the defaultHsUrl.
        defaultServerDiscoveryError: PropTypes.string,

        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,
        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        // Secondary HS which we try to log into if the user is using
        // the default HS but login fails. Useful for migrating to a
        // different homeserver without confusing users.
        fallbackHsUrl: PropTypes.string,

        defaultDeviceDisplayName: PropTypes.string,

        // login shouldn't know or care how registration is done.
        onRegisterClick: PropTypes.func.isRequired,

        // login shouldn't care how password recovery is done.
        onForgotPasswordClick: PropTypes.func,
        onServerConfigChange: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            loginIncorrect: false,

            enteredHsUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIsUrl: this.props.customIsUrl || this.props.defaultIsUrl,

            // used for preserving form values when changing homeserver
            username: "",
            phoneCountry: null,
            phoneNumber: "",

            // Phase of the overall login dialog.
            phase: PHASE_LOGIN,
            // The current login flow, such as password, SSO, etc.
            currentFlow: "m.login.password",

            // .well-known discovery
            discoveryError: "",
            findingHomeserver: false,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;

        // map from login step type to a function which will render a control
        // letting you do that login type
        this._stepRendererMap = {
            'm.login.password': this._renderPasswordStep,

            // CAS and SSO are the same thing, modulo the url we link to
            'm.login.cas': () => this._renderSsoStep(this._loginLogic.getSsoLoginUrl("cas")),
            'm.login.sso': () => this._renderSsoStep(this._loginLogic.getSsoLoginUrl("sso")),
        };

        this._initLoginLogic();
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    onPasswordLoginError: function(errorText) {
        this.setState({
            errorText,
            loginIncorrect: Boolean(errorText),
        });
    },

    onPasswordLogin: function(username, phoneCountry, phoneNumber, password) {
        // Prevent people from submitting their password when homeserver
        // discovery went wrong
        if (this.state.discoveryError || this.props.defaultServerDiscoveryError) return;

        this.setState({
            busy: true,
            errorText: null,
            loginIncorrect: false,
        });

        this._loginLogic.loginViaPassword(
            username, phoneCountry, phoneNumber, password,
        ).then((data) => {
            this.props.onLoggedIn(data);
        }, (error) => {
            if (this._unmounted) {
                return;
            }
            let errorText;

            // Some error strings only apply for logging in
            const usingEmail = username.indexOf("@") > 0;
            if (error.httpStatus === 400 && usingEmail) {
                errorText = _t('This homeserver does not support login using email address.');
            } else if (error.errcode == 'M_RESOURCE_LIMIT_EXCEEDED') {
                const errorTop = messageForResourceLimitError(
                    error.data.limit_type,
                    error.data.admin_contact, {
                    'monthly_active_user': _td(
                        "This homeserver has hit its Monthly Active User limit.",
                    ),
                    '': _td(
                        "This homeserver has exceeded one of its resource limits.",
                    ),
                });
                const errorDetail = messageForResourceLimitError(
                    error.data.limit_type,
                    error.data.admin_contact, {
                    '': _td(
                        "Please <a>contact your service administrator</a> to continue using this service.",
                    ),
                });
                errorText = (
                    <div>
                        <div>{errorTop}</div>
                        <div className="mx_Login_smallError">{errorDetail}</div>
                    </div>
                );
            } else if (error.httpStatus === 401 || error.httpStatus === 403) {
                if (SdkConfig.get()['disable_custom_urls']) {
                    errorText = (
                        <div>
                            <div>{ _t('Incorrect username and/or password.') }</div>
                            <div className="mx_Login_smallError">
                                { _t('Please note you are logging into the %(hs)s server, not matrix.org.',
                                    {
                                        hs: this.props.defaultHsUrl.replace(/^https?:\/\//, ''),
                                    })
                                }
                            </div>
                        </div>
                    );
                } else {
                    errorText = _t('Incorrect username and/or password.');
                }
            } else {
                // other errors, not specific to doing a password login
                errorText = this._errorTextFromError(error);
            }

            this.setState({
                errorText: errorText,
                // 401 would be the sensible status code for 'incorrect password'
                // but the login API gives a 403 https://matrix.org/jira/browse/SYN-744
                // mentions this (although the bug is for UI auth which is not this)
                // We treat both as an incorrect password
                loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
            });
        }).finally(() => {
            if (this._unmounted) {
                return;
            }
            this.setState({
                busy: false,
            });
        }).done();
    },

    onUsernameChanged: function(username) {
        this.setState({ username: username });
    },

    onUsernameBlur: function(username) {
        this.setState({
            username: username,
            discoveryError: null,
        });
        if (username[0] === "@") {
            const serverName = username.split(':').slice(1).join(':');
            try {
                // we have to append 'https://' to make the URL constructor happy
                // otherwise we get things like 'protocol: matrix.org, pathname: 8448'
                const url = new URL("https://" + serverName);
                this._tryWellKnownDiscovery(url.hostname);
            } catch (e) {
                console.error("Problem parsing URL or unhandled error doing .well-known discovery:", e);
                this.setState({discoveryError: _t("Failed to perform homeserver discovery")});
            }
        }
    },

    onPhoneCountryChanged: function(phoneCountry) {
        this.setState({ phoneCountry: phoneCountry });
    },

    onPhoneNumberChanged: function(phoneNumber) {
        this.setState({
            phoneNumber: phoneNumber,
        });
    },

    onPhoneNumberBlur: function(phoneNumber) {
        this.setState({
            errorText: null,
        });

        // Validate the phone number entered
        if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
            this.setState({
                errorText: _t('The phone number entered looks invalid'),
            });
        }
    },

    onServerConfigChange: function(config) {
        const self = this;
        const newState = {
            errorText: null, // reset err messages
        };
        if (config.hsUrl !== undefined) {
            newState.enteredHsUrl = config.hsUrl;
        }
        if (config.isUrl !== undefined) {
            newState.enteredIsUrl = config.isUrl;
        }

        this.props.onServerConfigChange(config);
        this.setState(newState, function() {
            self._initLoginLogic(config.hsUrl || null, config.isUrl);
        });
    },

    onRegisterClick: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onRegisterClick();
    },

    onServerDetailsNextPhaseClick(ev) {
        ev.stopPropagation();
        this.setState({
            phase: PHASE_LOGIN,
        });
    },

    onEditServerDetailsClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            phase: PHASE_SERVER_DETAILS,
        });
    },

    _tryWellKnownDiscovery: async function(serverName) {
        if (!serverName.trim()) {
            // Nothing to discover
            this.setState({
                discoveryError: "",
                findingHomeserver: false,
            });
            return;
        }

        this.setState({findingHomeserver: true});
        try {
            const discovery = await AutoDiscovery.findClientConfig(serverName);

            const state = discovery["m.homeserver"].state;
            if (state !== AutoDiscovery.SUCCESS && state !== AutoDiscovery.PROMPT) {
                this.setState({
                    discoveryError: discovery["m.homeserver"].error,
                    findingHomeserver: false,
                });
            } else if (state === AutoDiscovery.PROMPT) {
                this.setState({
                    discoveryError: "",
                    findingHomeserver: false,
                });
            } else if (state === AutoDiscovery.SUCCESS) {
                this.setState({
                    discoveryError: "",
                    findingHomeserver: false,
                });
                this.onServerConfigChange({
                    hsUrl: discovery["m.homeserver"].base_url,
                    isUrl: discovery["m.identity_server"].state === AutoDiscovery.SUCCESS
                        ? discovery["m.identity_server"].base_url
                        : "",
                });
            } else {
                console.warn("Unknown state for m.homeserver in discovery response: ", discovery);
                this.setState({
                    discoveryError: _t("Unknown failure discovering homeserver"),
                    findingHomeserver: false,
                });
            }
        } catch (e) {
            console.error(e);
            this.setState({
                findingHomeserver: false,
                discoveryError: _t("Unknown error discovering homeserver"),
            });
        }
    },

    _initLoginLogic: function(hsUrl, isUrl) {
        const self = this;
        hsUrl = hsUrl || this.state.enteredHsUrl;
        isUrl = isUrl || this.state.enteredIsUrl;

        const fallbackHsUrl = hsUrl === this.props.defaultHsUrl ? this.props.fallbackHsUrl : null;

        const loginLogic = new Login(hsUrl, isUrl, fallbackHsUrl, {
            defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
        });
        this._loginLogic = loginLogic;

        this.setState({
            enteredHsUrl: hsUrl,
            enteredIsUrl: isUrl,
            busy: true,
            loginIncorrect: false,
        });

        loginLogic.getFlows().then((flows) => {
            // look for a flow where we understand all of the steps.
            for (let i = 0; i < flows.length; i++ ) {
                if (!this._isSupportedFlow(flows[i])) {
                    continue;
                }

                // we just pick the first flow where we support all the
                // steps. (we don't have a UI for multiple logins so let's skip
                // that for now).
                loginLogic.chooseFlow(i);
                this.setState({
                    currentFlow: this._getCurrentFlowStep(),
                });
                return;
            }
            // we got to the end of the list without finding a suitable
            // flow.
            this.setState({
                errorText: _t(
                    "This homeserver doesn't offer any login flows which are " +
                        "supported by this client.",
                ),
            });
        }, function(err) {
            self.setState({
                errorText: self._errorTextFromError(err),
                loginIncorrect: false,
            });
        }).finally(function() {
            self.setState({
                busy: false,
            });
        }).done();
    },

    _isSupportedFlow: function(flow) {
        // technically the flow can have multiple steps, but no one does this
        // for login and loginLogic doesn't support it so we can ignore it.
        if (!this._stepRendererMap[flow.type]) {
            console.log("Skipping flow", flow, "due to unsupported login type", flow.type);
            return false;
        }
        return true;
    },

    _getCurrentFlowStep: function() {
        return this._loginLogic ? this._loginLogic.getCurrentFlowStep() : null;
    },

    _errorTextFromError(err) {
        let errCode = err.errcode;
        if (!errCode && err.httpStatus) {
            errCode = "HTTP " + err.httpStatus;
        }

        let errorText = _t("Error: Problem communicating with the given homeserver.") +
                (errCode ? " (" + errCode + ")" : "");

        if (err.cors === 'rejected') {
            if (window.location.protocol === 'https:' &&
                (this.state.enteredHsUrl.startsWith("http:") ||
                 !this.state.enteredHsUrl.startsWith("http"))
            ) {
                errorText = <span>
                    { _t("Can't connect to homeserver via HTTP when an HTTPS URL is in your browser bar. " +
                        "Either use HTTPS or <a>enable unsafe scripts</a>.", {},
                        {
                            'a': (sub) => {
                                return <a target="_blank" rel="noopener"
                                    href="https://www.google.com/search?&q=enable%20unsafe%20scripts"
                                >
                                    { sub }
                                </a>;
                            },
                        },
                    ) }
                </span>;
            } else {
                errorText = <span>
                    { _t("Can't connect to homeserver - please check your connectivity, ensure your " +
                        "<a>homeserver's SSL certificate</a> is trusted, and that a browser extension " +
                        "is not blocking requests.", {},
                        {
                            'a': (sub) => {
                                return <a target="_blank" rel="noopener"
                                    href={this.state.enteredHsUrl}
                                >{ sub }</a>;
                            },
                        },
                    ) }
                </span>;
            }
        }

        return errorText;
    },

    renderServerComponent() {
        const ServerConfig = sdk.getComponent("auth.ServerConfig");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        if (SdkConfig.get()['disable_custom_urls']) {
            return null;
        }

        if (PHASES_ENABLED && this.state.phase !== PHASE_SERVER_DETAILS) {
            return null;
        }

        const serverDetails = <ServerConfig
            customHsUrl={this.state.enteredHsUrl}
            customIsUrl={this.state.enteredIsUrl}
            defaultHsUrl={this.props.defaultHsUrl}
            defaultIsUrl={this.props.defaultIsUrl}
            onServerConfigChange={this.onServerConfigChange}
            delayTimeMs={250}
        />;

        let nextButton = null;
        if (PHASES_ENABLED) {
            nextButton = <AccessibleButton className="mx_Login_submit"
                onClick={this.onServerDetailsNextPhaseClick}
            >
                {_t("Next")}
            </AccessibleButton>;
        }

        return <div>
            {serverDetails}
            {nextButton}
        </div>;
    },

    renderLoginComponentForStep() {
        if (PHASES_ENABLED && this.state.phase !== PHASE_LOGIN) {
            return null;
        }

        const step = this.state.currentFlow;

        if (!step) {
            return null;
        }

        const stepRenderer = this._stepRendererMap[step];

        if (stepRenderer) {
            return stepRenderer();
        }

        return null;
    },

    _renderPasswordStep: function() {
        const PasswordLogin = sdk.getComponent('auth.PasswordLogin');

        let onEditServerDetailsClick = null;
        // If custom URLs are allowed, wire up the server details edit link.
        if (PHASES_ENABLED && !SdkConfig.get()['disable_custom_urls']) {
            onEditServerDetailsClick = this.onEditServerDetailsClick;
        }

        // If the current HS URL is the default HS URL, then we can label it
        // with the default HS name (if it exists).
        let hsName;
        if (this.state.enteredHsUrl === this.props.defaultHsUrl) {
            hsName = this.props.defaultServerName;
        }

        return (
            <PasswordLogin
               onSubmit={this.onPasswordLogin}
               onError={this.onPasswordLoginError}
               onEditServerDetailsClick={onEditServerDetailsClick}
               initialUsername={this.state.username}
               initialPhoneCountry={this.state.phoneCountry}
               initialPhoneNumber={this.state.phoneNumber}
               onUsernameChanged={this.onUsernameChanged}
               onUsernameBlur={this.onUsernameBlur}
               onPhoneCountryChanged={this.onPhoneCountryChanged}
               onPhoneNumberChanged={this.onPhoneNumberChanged}
               onPhoneNumberBlur={this.onPhoneNumberBlur}
               onForgotPasswordClick={this.props.onForgotPasswordClick}
               loginIncorrect={this.state.loginIncorrect}
               hsName={hsName}
               hsUrl={this.state.enteredHsUrl}
               disableSubmit={this.state.findingHomeserver}
               />
        );
    },

    _renderSsoStep: function(url) {
        // XXX: This link does *not* have a target="_blank" because single sign-on relies on
        // redirecting the user back to a URI once they're logged in. On the web, this means
        // we use the same window and redirect back to riot. On electron, this actually
        // opens the SSO page in the electron app itself due to
        // https://github.com/electron/electron/issues/8841 and so happens to work.
        // If this bug gets fixed, it will break SSO since it will open the SSO page in the
        // user's browser, let them log into their SSO provider, then redirect their browser
        // to vector://vector which, of course, will not work.
        return (
            <a href={url} className="mx_Login_sso_link mx_Login_submit">{ _t('Sign in with single sign-on') }</a>
        );
    },

    render: function() {
        const Loader = sdk.getComponent("elements.Spinner");
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const AuthHeader = sdk.getComponent("auth.AuthHeader");
        const AuthBody = sdk.getComponent("auth.AuthBody");
        const loader = this.state.busy ? <div className="mx_Login_loader"><Loader /></div> : null;

        const errorText = this.props.defaultServerDiscoveryError || this.state.discoveryError || this.state.errorText;

        let errorTextSection;
        if (errorText) {
            errorTextSection = (
                <div className="mx_Login_error">
                    { errorText }
                </div>
            );
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2>
                        {_t('Sign in')}
                        {loader}
                    </h2>
                    { errorTextSection }
                    { this.renderServerComponent() }
                    { this.renderLoginComponentForStep() }
                    <a className="mx_AuthBody_changeFlow" onClick={this.onRegisterClick} href="#">
                        { _t('Create account') }
                    </a>
                </AuthBody>
            </AuthPage>
        );
    },
});
