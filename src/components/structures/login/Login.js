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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { _t, _td } from '../../../languageHandler';
import sdk from '../../../index';
import Login from '../../../Login';
import SdkConfig from '../../../SdkConfig';
import SettingsStore from "../../../settings/SettingsStore";
import { messageForResourceLimitError } from '../../../utils/ErrorUtils';
import { AutoDiscovery } from "matrix-js-sdk";

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

// These are used in several places, and come from the js-sdk's autodiscovery
// stuff. We define them here so that they'll be picked up by i18n.
_td("Invalid homeserver discovery response");
_td("Invalid identity server discovery response");
_td("General failure");

/**
 * A wire component which glues together login UI components and Login logic
 */
module.exports = React.createClass({
    displayName: 'Login',

    propTypes: {
        onLoggedIn: PropTypes.func.isRequired,

        enableGuest: PropTypes.bool,

        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,
        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        // Secondary HS which we try to log into if the user is using
        // the default HS but login fails. Useful for migrating to a
        // different home server without confusing users.
        fallbackHsUrl: PropTypes.string,

        // The default server name to use when the user hasn't specified
        // one. This is used when displaying the defaultHsUrl in the UI.
        defaultServerName: PropTypes.string,

        // An error passed along from higher up explaining that something
        // went wrong when finding the defaultHsUrl.
        defaultServerDiscoveryError: PropTypes.string,

        defaultDeviceDisplayName: PropTypes.string,

        // login shouldn't know or care how registration is done.
        onRegisterClick: PropTypes.func.isRequired,

        // login shouldn't care how password recovery is done.
        onForgotPasswordClick: PropTypes.func,
        onCancelClick: PropTypes.func,
        onServerConfigChange: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            loginIncorrect: false,
            enteredHomeserverUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIdentityServerUrl: this.props.customIsUrl || this.props.defaultIsUrl,

            // used for preserving form values when changing homeserver
            username: "",
            phoneCountry: null,
            phoneNumber: "",
            currentFlow: "m.login.password",

            // .well-known discovery
            discoveredHsUrl: "",
            discoveredIsUrl: "",
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
                errorText = _t('This Home Server does not support login using email address.');
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

    _onLoginAsGuestClick: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const self = this;
        self.setState({
            busy: true,
            errorText: null,
            loginIncorrect: false,
        });

        this._loginLogic.loginAsGuest().then(function(data) {
            self.props.onLoggedIn(data);
        }, function(error) {
            let errorText;
            if (error.httpStatus === 403) {
                errorText = _t("Guest access is disabled on this Home Server.");
            } else {
                errorText = self._errorTextFromError(error);
            }
            self.setState({
                errorText: errorText,
                loginIncorrect: false,
            });
        }).finally(function() {
            self.setState({
                busy: false,
            });
        }).done();
    },

    onUsernameChanged: function(username) {
        this.setState({ username: username });
    },

    onUsernameBlur: function(username) {
        this.setState({ username: username });
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
        // Validate the phone number entered
        if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
            this.setState({ errorText: _t('The phone number entered looks invalid') });
            return;
        }

        this.setState({
            phoneNumber: phoneNumber,
            errorText: null,
        });
    },

    onServerConfigChange: function(config) {
        const self = this;
        const newState = {
            errorText: null, // reset err messages
        };
        if (config.hsUrl !== undefined) {
            newState.enteredHomeserverUrl = config.hsUrl;
        }
        if (config.isUrl !== undefined) {
            newState.enteredIdentityServerUrl = config.isUrl;
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

    _tryWellKnownDiscovery: async function(serverName) {
        if (!serverName.trim()) {
            // Nothing to discover
            this.setState({discoveryError: "", discoveredHsUrl: "", discoveredIsUrl: "", findingHomeserver: false});
            return;
        }

        this.setState({findingHomeserver: true});
        try {
            const discovery = await AutoDiscovery.findClientConfig(serverName);
            const state = discovery["m.homeserver"].state;
            if (state !== AutoDiscovery.SUCCESS && state !== AutoDiscovery.PROMPT) {
                this.setState({
                    discoveredHsUrl: "",
                    discoveredIsUrl: "",
                    discoveryError: discovery["m.homeserver"].error,
                    findingHomeserver: false,
                });
            } else if (state === AutoDiscovery.PROMPT) {
                this.setState({
                    discoveredHsUrl: "",
                    discoveredIsUrl: "",
                    discoveryError: "",
                    findingHomeserver: false,
                });
            } else if (state === AutoDiscovery.SUCCESS) {
                this.setState({
                    discoveredHsUrl: discovery["m.homeserver"].base_url,
                    discoveredIsUrl:
                        discovery["m.identity_server"].state === AutoDiscovery.SUCCESS
                            ? discovery["m.identity_server"].base_url
                            : "",
                    discoveryError: "",
                    findingHomeserver: false,
                });
            } else {
                console.warn("Unknown state for m.homeserver in discovery response: ", discovery);
                this.setState({
                    discoveredHsUrl: "",
                    discoveredIsUrl: "",
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
        hsUrl = hsUrl || this.state.enteredHomeserverUrl;
        isUrl = isUrl || this.state.enteredIdentityServerUrl;

        const fallbackHsUrl = hsUrl === this.props.defaultHsUrl ? this.props.fallbackHsUrl : null;

        const loginLogic = new Login(hsUrl, isUrl, fallbackHsUrl, {
            defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
        });
        this._loginLogic = loginLogic;

        this.setState({
            enteredHomeserverUrl: hsUrl,
            enteredIdentityServerUrl: isUrl,
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
                (this.state.enteredHomeserverUrl.startsWith("http:") ||
                 !this.state.enteredHomeserverUrl.startsWith("http"))
            ) {
                errorText = <span>
                    { _t("Can't connect to homeserver via HTTP when an HTTPS URL is in your browser bar. " +
                        "Either use HTTPS or <a>enable unsafe scripts</a>.", {},
                        {
                            'a': (sub) => {
                                return <a href="https://www.google.com/search?&q=enable%20unsafe%20scripts">
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
                                return <a href={this.state.enteredHomeserverUrl}>{ sub }</a>;
                            },
                        },
                    ) }
                </span>;
            }
        }

        return errorText;
    },

    componentForStep: function(step) {
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
        const PasswordLogin = sdk.getComponent('login.PasswordLogin');
        return (
            <PasswordLogin
               onSubmit={this.onPasswordLogin}
               onError={this.onPasswordLoginError}
               initialUsername={this.state.username}
               initialPhoneCountry={this.state.phoneCountry}
               initialPhoneNumber={this.state.phoneNumber}
               onUsernameChanged={this.onUsernameChanged}
               onUsernameBlur={this.onUsernameBlur}
               onPhoneCountryChanged={this.onPhoneCountryChanged}
               onPhoneNumberChanged={this.onPhoneNumberChanged}
               onForgotPasswordClick={this.props.onForgotPasswordClick}
               loginIncorrect={this.state.loginIncorrect}
               hsUrl={this.state.enteredHomeserverUrl}
               hsName={this.props.defaultServerName}
               disableSubmit={this.state.findingHomeserver}
               />
        );
    },

    _renderSsoStep: function(url) {
        return (
            <a href={url} className="mx_Login_sso_link">{ _t('Sign in with single sign-on') }</a>
        );
    },

    render: function() {
        const Loader = sdk.getComponent("elements.Spinner");
        const LoginPage = sdk.getComponent("login.LoginPage");
        const LoginHeader = sdk.getComponent("login.LoginHeader");
        const LoginFooter = sdk.getComponent("login.LoginFooter");
        const ServerConfig = sdk.getComponent("login.ServerConfig");
        const loader = this.state.busy ? <div className="mx_Login_loader"><Loader /></div> : null;

        const errorText = this.props.defaultServerDiscoveryError || this.state.discoveryError || this.state.errorText;

        let loginAsGuestJsx;
        if (this.props.enableGuest) {
            loginAsGuestJsx =
                <a className="mx_Login_create" onClick={this._onLoginAsGuestClick} href="#">
                    { _t('Try the app first') }
                </a>;
        }

        let serverConfig;
        let header;

        if (!SdkConfig.get()['disable_custom_urls']) {
            serverConfig = <ServerConfig ref="serverConfig"
                withToggleButton={true}
                customHsUrl={this.state.discoveredHsUrl || this.props.customHsUrl}
                customIsUrl={this.state.discoveredIsUrl || this.props.customIsUrl}
                defaultHsUrl={this.props.defaultHsUrl}
                defaultIsUrl={this.props.defaultIsUrl}
                onServerConfigChange={this.onServerConfigChange}
                delayTimeMs={1000} />;
        }

        // FIXME: remove status.im theme tweaks
        const theme = SettingsStore.getValue("theme");
        if (theme !== "status") {
            header = <h2>{ _t('Sign in') } { loader }</h2>;
        } else {
            if (!errorText) {
                header = <h2>{ _t('Sign in to get started') } { loader }</h2>;
            }
        }

        let errorTextSection;
        if (errorText) {
            errorTextSection = (
                <div className="mx_Login_error">
                    { errorText }
                </div>
            );
        }

        const LanguageSelector = sdk.getComponent('structures.login.LanguageSelector');

        return (
            <LoginPage>
                <div className="mx_Login_box">
                    <LoginHeader />
                    <div>
                        { header }
                        { errorTextSection }
                        { this.componentForStep(this.state.currentFlow) }
                        { serverConfig }
                        <a className="mx_Login_create" onClick={this.onRegisterClick} href="#">
                            { _t('Create an account') }
                        </a>
                        { loginAsGuestJsx }
                        <LanguageSelector />
                        <LoginFooter />
                    </div>
                </div>
            </LoginPage>
        );
    },
});
