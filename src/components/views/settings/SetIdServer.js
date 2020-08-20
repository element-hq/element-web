/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import url from 'url';
import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import * as sdk from '../../../index';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Modal from '../../../Modal';
import dis from "../../../dispatcher/dispatcher";
import { getThreepidsWithBindStatus } from '../../../boundThreepids';
import IdentityAuthClient from "../../../IdentityAuthClient";
import {abbreviateUrl, unabbreviateUrl} from "../../../utils/UrlUtils";
import { getDefaultIdentityServerUrl, doesIdentityServerHaveTerms } from '../../../utils/IdentityServerUtils';
import {timeout} from "../../../utils/promise";

// We'll wait up to this long when checking for 3PID bindings on the IS.
const REACHABILITY_TIMEOUT = 10000; // ms

/**
 * Check an IS URL is valid, including liveness check
 *
 * @param {string} u The url to check
 * @returns {string} null if url passes all checks, otherwise i18ned error string
 */
async function checkIdentityServerUrl(u) {
    const parsedUrl = url.parse(u);

    if (parsedUrl.protocol !== 'https:') return _t("Identity Server URL must be HTTPS");

    // XXX: duplicated logic from js-sdk but it's quite tied up in the validation logic in the
    // js-sdk so probably as easy to duplicate it than to separate it out so we can reuse it
    try {
        const response = await fetch(u + '/_matrix/identity/api/v1');
        if (response.ok) {
            return null;
        } else if (response.status < 200 || response.status >= 300) {
            return _t("Not a valid Identity Server (status code %(code)s)", {code: response.status});
        } else {
            return _t("Could not connect to Identity Server");
        }
    } catch (e) {
        return _t("Could not connect to Identity Server");
    }
}

export default class SetIdServer extends React.Component {
    static propTypes = {
        // Whether or not the ID server is missing terms. This affects the text
        // shown to the user.
        missingTerms: PropTypes.bool,
    };

    constructor() {
        super();

        let defaultIdServer = '';
        if (!MatrixClientPeg.get().getIdentityServerUrl() && getDefaultIdentityServerUrl()) {
            // If no ID server is configured but there's one in the config, prepopulate
            // the field to help the user.
            defaultIdServer = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.state = {
            defaultIdServer,
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
            idServer: "",
            error: null,
            busy: false,
            disconnectBusy: false,
            checking: false,
        };
    }

    componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    onAction = (payload) => {
        // We react to changes in the ID server in the event the user is staring at this form
        // when changing their identity server on another device.
        if (payload.action !== "id_server_changed") return;

        this.setState({
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
        });
    };

    _onIdentityServerChanged = (ev) => {
        const u = ev.target.value;

        this.setState({idServer: u});
    };

    _getTooltip = () => {
        if (this.state.checking) {
            const InlineSpinner = sdk.getComponent('views.elements.InlineSpinner');
            return <div>
                <InlineSpinner />
                { _t("Checking server") }
            </div>;
        } else if (this.state.error) {
            return <span className='warning'>{this.state.error}</span>;
        } else {
            return null;
        }
    };

    _idServerChangeEnabled = () => {
        return !!this.state.idServer && !this.state.busy;
    };

    _saveIdServer = (fullUrl) => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.get().setAccountData("m.identity_server", {
            base_url: fullUrl,
        });
        this.setState({
            busy: false,
            error: null,
            currentClientIdServer: fullUrl,
            idServer: '',
        });
    };

    _checkIdServer = async (e) => {
        e.preventDefault();
        const { idServer, currentClientIdServer } = this.state;

        this.setState({busy: true, checking: true, error: null});

        const fullUrl = unabbreviateUrl(idServer);

        let errStr = await checkIdentityServerUrl(fullUrl);
        if (!errStr) {
            try {
                this.setState({checking: false}); // clear tooltip

                // Test the identity server by trying to register with it. This
                // may result in a terms of service prompt.
                const authClient = new IdentityAuthClient(fullUrl);
                await authClient.getAccessToken();

                let save = true;

                // Double check that the identity server even has terms of service.
                const hasTerms = await doesIdentityServerHaveTerms(fullUrl);
                if (!hasTerms) {
                    const [confirmed] = await this._showNoTermsWarning(fullUrl);
                    save = confirmed;
                }

                // Show a general warning, possibly with details about any bound
                // 3PIDs that would be left behind.
                if (save && currentClientIdServer && fullUrl !== currentClientIdServer) {
                    const [confirmed] = await this._showServerChangeWarning({
                        title: _t("Change identity server"),
                        unboundMessage: _t(
                            "Disconnect from the identity server <current /> and " +
                            "connect to <new /> instead?", {},
                            {
                                current: sub => <b>{abbreviateUrl(currentClientIdServer)}</b>,
                                new: sub => <b>{abbreviateUrl(idServer)}</b>,
                            },
                        ),
                        button: _t("Continue"),
                    });
                    save = confirmed;
                }

                if (save) {
                    this._saveIdServer(fullUrl);
                }
            } catch (e) {
                console.error(e);
                errStr = _t("Terms of service not accepted or the identity server is invalid.");
            }
        }
        this.setState({
            busy: false,
            checking: false,
            error: errStr,
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
        });
    };

    _showNoTermsWarning(fullUrl) {
        const QuestionDialog = sdk.getComponent("views.dialogs.QuestionDialog");
        const { finished } = Modal.createTrackedDialog('No Terms Warning', '', QuestionDialog, {
            title: _t("Identity server has no terms of service"),
            description: (
                <div>
                    <span className="warning">
                        {_t("The identity server you have chosen does not have any terms of service.")}
                    </span>
                    <span>
                        &nbsp;{_t("Only continue if you trust the owner of the server.")}
                    </span>
                </div>
            ),
            button: _t("Continue"),
        });
        return finished;
    }

    _onDisconnectClicked = async () => {
        this.setState({disconnectBusy: true});
        try {
            const [confirmed] = await this._showServerChangeWarning({
                title: _t("Disconnect identity server"),
                unboundMessage: _t(
                    "Disconnect from the identity server <idserver />?", {},
                    {idserver: sub => <b>{abbreviateUrl(this.state.currentClientIdServer)}</b>},
                ),
                button: _t("Disconnect"),
            });
            if (confirmed) {
                this._disconnectIdServer();
            }
        } finally {
            this.setState({disconnectBusy: false});
        }
    };

    async _showServerChangeWarning({ title, unboundMessage, button }) {
        const { currentClientIdServer } = this.state;

        let threepids = [];
        let currentServerReachable = true;
        try {
            threepids = await timeout(
                getThreepidsWithBindStatus(MatrixClientPeg.get()),
                Promise.reject(new Error("Timeout attempting to reach identity server")),
                REACHABILITY_TIMEOUT,
            );
        } catch (e) {
            currentServerReachable = false;
            console.warn(
                `Unable to reach identity server at ${currentClientIdServer} to check ` +
                `for 3PIDs during IS change flow`,
            );
            console.warn(e);
        }
        const boundThreepids = threepids.filter(tp => tp.bound);
        let message;
        let danger = false;
        const messageElements = {
            idserver: sub => <b>{abbreviateUrl(currentClientIdServer)}</b>,
            b: sub => <b>{sub}</b>,
        };
        if (!currentServerReachable) {
            message = <div>
                <p>{_t(
                    "You should <b>remove your personal data</b> from identity server " +
                    "<idserver /> before disconnecting. Unfortunately, identity server " +
                    "<idserver /> is currently offline or cannot be reached.",
                    {}, messageElements,
                )}</p>
                <p>{_t("You should:")}</p>
                <ul>
                    <li>{_t(
                        "check your browser plugins for anything that might block " +
                        "the identity server (such as Privacy Badger)",
                    )}</li>
                    <li>{_t("contact the administrators of identity server <idserver />", {}, {
                        idserver: messageElements.idserver,
                    })}</li>
                    <li>{_t("wait and try again later")}</li>
                </ul>
            </div>;
            danger = true;
            button = _t("Disconnect anyway");
        } else if (boundThreepids.length) {
            message = <div>
                <p>{_t(
                    "You are still <b>sharing your personal data</b> on the identity " +
                    "server <idserver />.", {}, messageElements,
                )}</p>
                <p>{_t(
                    "We recommend that you remove your email addresses and phone numbers " +
                    "from the identity server before disconnecting.",
                )}</p>
            </div>;
            danger = true;
            button = _t("Disconnect anyway");
        } else {
            message = unboundMessage;
        }

        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const { finished } = Modal.createTrackedDialog('Identity Server Bound Warning', '', QuestionDialog, {
            title,
            description: message,
            button,
            cancelButton: _t("Go back"),
            danger,
        });
        return finished;
    }

    _disconnectIdServer = () => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.get().setAccountData("m.identity_server", {
            base_url: null, // clear
        });

        let newFieldVal = '';
        if (getDefaultIdentityServerUrl()) {
            // Prepopulate the client's default so the user at least has some idea of
            // a valid value they might enter
            newFieldVal = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.setState({
            busy: false,
            error: null,
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
            idServer: newFieldVal,
        });
    };

    render() {
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');
        const Field = sdk.getComponent('elements.Field');
        const idServerUrl = this.state.currentClientIdServer;
        let sectionTitle;
        let bodyText;
        if (idServerUrl) {
            sectionTitle = _t("Identity Server (%(server)s)", { server: abbreviateUrl(idServerUrl) });
            bodyText = _t(
                "You are currently using <server></server> to discover and be discoverable by " +
                "existing contacts you know. You can change your identity server below.",
                {},
                { server: sub => <b>{abbreviateUrl(idServerUrl)}</b> },
            );
            if (this.props.missingTerms) {
                bodyText = _t(
                    "If you don't want to use <server /> to discover and be discoverable by existing " +
                    "contacts you know, enter another identity server below.",
                    {}, {server: sub => <b>{abbreviateUrl(idServerUrl)}</b>},
                );
            }
        } else {
            sectionTitle = _t("Identity Server");
            bodyText = _t(
                "You are not currently using an identity server. " +
                "To discover and be discoverable by existing contacts you know, " +
                "add one below.",
            );
        }

        let discoSection;
        if (idServerUrl) {
            let discoButtonContent = _t("Disconnect");
            let discoBodyText = _t(
                "Disconnecting from your identity server will mean you " +
                "won't be discoverable by other users and you won't be " +
                "able to invite others by email or phone.",
            );
            if (this.props.missingTerms) {
                discoBodyText = _t(
                    "Using an identity server is optional. If you choose not to " +
                    "use an identity server, you won't be discoverable by other users " +
                    "and you won't be able to invite others by email or phone.",
                );
                discoButtonContent = _t("Do not use an identity server");
            }
            if (this.state.disconnectBusy) {
                const InlineSpinner = sdk.getComponent('views.elements.InlineSpinner');
                discoButtonContent = <InlineSpinner />;
            }
            discoSection = <div>
                <span className="mx_SettingsTab_subsectionText">{discoBodyText}</span>
                <AccessibleButton onClick={this._onDisconnectClicked} kind="danger_sm">
                    {discoButtonContent}
                </AccessibleButton>
            </div>;
        }

        return (
            <form className="mx_SettingsTab_section mx_SetIdServer" onSubmit={this._checkIdServer}>
                <span className="mx_SettingsTab_subheading">
                    {sectionTitle}
                </span>
                <span className="mx_SettingsTab_subsectionText">
                    {bodyText}
                </span>
                <Field
                    label={_t("Enter a new identity server")}
                    type="text"
                    autoComplete="off"
                    placeholder={this.state.defaultIdServer}
                    value={this.state.idServer}
                    onChange={this._onIdentityServerChanged}
                    tooltipContent={this._getTooltip()}
                    tooltipClassName="mx_SetIdServer_tooltip"
                    disabled={this.state.busy}
                    forceValidity={this.state.error ? false : null}
                />
                <AccessibleButton type="submit" kind="primary_sm"
                    onClick={this._checkIdServer}
                    disabled={!this._idServerChangeEnabled()}
                >{_t("Change")}</AccessibleButton>
                {discoSection}
            </form>
        );
    }
}
