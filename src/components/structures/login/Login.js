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
import request from 'browser-request';

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

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
        if (this.state.discoveryError) return;

        if (this.state.discoveredHsUrl) {
            console.log("Rewriting username because the homeserver was discovered");
            username = username.substring(1).split(":")[0];
        }

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

    _onLoginAsGuestClick: function() {
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

    onUsernameChanged: function(username, endOfInput) {
        this.setState({ username: username });
        if (username[0] === "@" && endOfInput) {
            const serverName = username.split(':').slice(1).join(':');
            this._tryWellKnownDiscovery(serverName);
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

    _tryWellKnownDiscovery: async function(serverName) {
        if (!serverName.trim()) {
            // Nothing to discover
            this.setState({discoveryError: "", discoveredHsUrl: "", discoveredIsUrl: ""});
            return;
        }

        try {
            const wellknown = await this._getWellKnownObject(`https://${serverName}/.well-known/matrix/client`);
            if (!wellknown["m.homeserver"]) {
                console.error("No m.homeserver key in well-known response");
                this.setState({discoveryError: _t("Invalid homeserver discovery response")});
                return;
            }

            const hsUrl = this._sanitizeWellKnownUrl(wellknown["m.homeserver"]["base_url"]);
            if (!hsUrl) {
                console.error("Invalid base_url for m.homeserver");
                this.setState({discoveryError: _t("Invalid homeserver discovery response")});
                return;
            }

            console.log("Verifying homeserver URL: " + hsUrl);
            const hsVersions = await this._getWellKnownObject(`${hsUrl}/_matrix/client/versions`);
            if (!hsVersions["versions"]) {
                console.error("Invalid /versions response");
                this.setState({discoveryError: _t("Invalid homeserver discovery response")});
                return;
            }

            let isUrl = "";
            if (wellknown["m.identity_server"]) {
                isUrl = this._sanitizeWellKnownUrl(wellknown["m.identity_server"]["base_url"]);
                if (!isUrl) {
                    console.error("Invalid base_url for m.identity_server");
                    this.setState({discoveryError: _t("Invalid homeserver discovery response")});
                    return;
                }

                // XXX: We don't verify the identity server URL because sydent doesn't register
                // the route we need.

                // console.log("Verifying identity server URL: " + isUrl);
                // const isResponse = await this._getWellKnownObject(`${isUrl}/_matrix/identity/api/v1`);
                // if (!isResponse) {
                //     console.error("Invalid /api/v1 response");
                //     this.setState({discoveryError: _t("Invalid homeserver discovery response")});
                //     return;
                // }
            }

            this.setState({discoveredHsUrl: hsUrl, discoveredIsUrl: isUrl, discoveryError: ""});
        } catch (e) {
            console.error(e);
            if (e.wkAction) {
                if (e.wkAction === "FAIL_ERROR" || e.wkAction === "FAIL_PROMPT") {
                    // We treat FAIL_ERROR and FAIL_PROMPT the same to avoid having the user
                    // submit their details to the wrong homeserver. In practice, the custom
                    // server options will show up to try and guide the user into entering
                    // the required information.
                    this.setState({discoveryError: _t("Cannot find homeserver")});
                    return;
                } else if (e.wkAction === "IGNORE") {
                    // Nothing to discover
                    this.setState({discoveryError: "", discoveredHsUrl: "", discoveredIsUrl: ""});
                    return;
                }
            }

            throw e;
        }
    },

    _sanitizeWellKnownUrl: function(url) {
        if (!url) return false;

        const parser = document.createElement('a');
        parser.href = url;

        if (parser.protocol !== "http:" && parser.protocol !== "https:") return false;
        if (!parser.hostname) return false;

        const port = parser.port ? `:${parser.port}` : "";
        const path = parser.pathname ? parser.pathname : "";
        let saferUrl = `${parser.protocol}//${parser.hostname}${port}${path}`;
        if (saferUrl.endsWith("/")) saferUrl = saferUrl.substring(0, saferUrl.length - 1);
        return saferUrl;
    },

    _getWellKnownObject: function(url) {
        return new Promise(function(resolve, reject) {
            request(
                { method: "GET", url: url },
                (err, response, body) => {
                    if (err || response.status < 200 || response.status >= 300) {
                        let action = "FAIL_ERROR";
                        if (response.status === 404) {
                            // We could just resolve with an empty object, but that
                            // causes a different series of branches when the m.homeserver
                            // bit of the JSON is missing.
                            action = "IGNORE";
                        }
                        reject({err: err, response: response, wkAction: action});
                        return;
                    }

                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        console.error(e);
                        if (e.name === "SyntaxError") {
                            reject({wkAction: "FAIL_PROMPT", wkError: "Invalid JSON"});
                        } else throw e;
                    }
                },
            );
        });
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
               onPhoneCountryChanged={this.onPhoneCountryChanged}
               onPhoneNumberChanged={this.onPhoneNumberChanged}
               onForgotPasswordClick={this.props.onForgotPasswordClick}
               loginIncorrect={this.state.loginIncorrect}
               hsUrl={this.state.enteredHomeserverUrl}
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

        const errorText = this.state.discoveryError || this.state.errorText;

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
                customIsUrl={this.state.discoveredIsUrl ||this.props.customIsUrl}
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
                        <a className="mx_Login_create" onClick={this.props.onRegisterClick} href="#">
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
