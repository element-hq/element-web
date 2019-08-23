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
import {_t} from "../../../languageHandler";
import sdk from '../../../index';
import MatrixClientPeg from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import Modal from '../../../Modal';
import dis from "../../../dispatcher";
import { getThreepidBindStatus } from '../../../boundThreepids';
import IdentityAuthClient from "../../../IdentityAuthClient";
import {SERVICE_TYPES} from "matrix-js-sdk";
import {abbreviateUrl, unabbreviateUrl} from "../../../utils/UrlUtils";

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
    constructor() {
        super();

        let defaultIdServer = '';
        if (!MatrixClientPeg.get().getIdentityServerUrl() && SdkConfig.get()['validated_server_config']['isUrl']) {
            // If no ID server is configured but there's one in the config, prepopulate
            // the field to help the user.
            defaultIdServer = abbreviateUrl(SdkConfig.get()['validated_server_config']['isUrl']);
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
        // when changing their identity server on another device. If the user is trying to change
        // it in two places, we'll end up stomping all over their input, but at that point we
        // should question our UX which led to them doing that.
        if (payload.action !== "id_server_changed") return;

        const fullUrl = MatrixClientPeg.get().getIdentityServerUrl();
        let abbr = '';
        if (fullUrl) abbr = abbreviateUrl(fullUrl);

        this.setState({
            currentClientIdServer: fullUrl,
            idServer: abbr,
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
        this.setState({idServer: '', busy: false, error: null});
    };

    _checkIdServer = async (e) => {
        e.preventDefault();

        this.setState({busy: true, checking: true, error: null});

        const fullUrl = unabbreviateUrl(this.state.idServer);

        let errStr = await checkIdentityServerUrl(fullUrl);
        if (!errStr) {
            try {
                this.setState({checking: false}); // clear tooltip

                // Test the identity server by trying to register with it. This
                // may result in a terms of service prompt.
                const authClient = new IdentityAuthClient(fullUrl);
                await authClient.getAccessToken();

                // Double check that the identity server even has terms of service.
                const terms = await MatrixClientPeg.get().getTerms(SERVICE_TYPES.IS, fullUrl);
                if (!terms || !terms["policies"] || Object.keys(terms["policies"]).length <= 0) {
                    this._showNoTermsWarning(fullUrl);
                    return;
                }

                this._saveIdServer(fullUrl);
            } catch (e) {
                console.error(e);
                if (e.cors === "rejected" || e.httpStatus === 404) {
                    this._showNoTermsWarning(fullUrl);
                    return;
                }
                errStr = _t("Terms of service not accepted or the identity server is invalid.");
            }
        }
        this.setState({
            busy: false,
            checking: false,
            error: errStr,
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
            idServer: this.state.idServer,
        });
    };

    _showNoTermsWarning(fullUrl) {
        const QuestionDialog = sdk.getComponent("views.dialogs.QuestionDialog");
        Modal.createTrackedDialog('No Terms Warning', '', QuestionDialog, {
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
            onFinished: async (confirmed) => {
                if (!confirmed) return;
                this._saveIdServer(fullUrl);
            },
        });
    }

    _onDisconnectClicked = async () => {
        this.setState({disconnectBusy: true});
        try {
            const threepids = await getThreepidBindStatus(MatrixClientPeg.get());

            const boundThreepids = threepids.filter(tp => tp.bound);
            let message;
            if (boundThreepids.length) {
                message = _t(
                    "You are currently sharing email addresses or phone numbers on the identity " +
                    "server <idserver />. You will need to reconnect to <idserver2 /> to stop " +
                    "sharing them.", {},
                    {
                        idserver: sub => <b>{abbreviateUrl(this.state.currentClientIdServer)}</b>,
                        // XXX: https://github.com/vector-im/riot-web/issues/9086
                        idserver2: sub => <b>{abbreviateUrl(this.state.currentClientIdServer)}</b>,
                    },
                );
            } else {
                message = _t(
                    "Disconnect from the identity server <idserver />?", {},
                    {idserver: sub => <b>{abbreviateUrl(this.state.currentClientIdServer)}</b>},
                );
            }

            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createTrackedDialog('Identity Server Disconnect Warning', '', QuestionDialog, {
                title: _t("Disconnect Identity Server"),
                description: message,
                button: _t("Disconnect"),
                onFinished: (confirmed) => {
                    if (confirmed) {
                        this._disconnectIdServer();
                    }
                },
            });
        } finally {
            this.setState({disconnectBusy: false});
        }
    };

    _disconnectIdServer = () => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.get().setAccountData("m.identity_server", {
            base_url: null, // clear
        });

        let newFieldVal = '';
        if (SdkConfig.get()['validated_server_config']['isUrl']) {
            // Prepopulate the client's default so the user at least has some idea of
            // a valid value they might enter
            newFieldVal = abbreviateUrl(SdkConfig.get()['validated_server_config']['isUrl']);
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
            if (this.state.disconnectBusy) {
                const InlineSpinner = sdk.getComponent('views.elements.InlineSpinner');
                discoButtonContent = <InlineSpinner />;
            }
            discoSection = <div>
                <span className="mx_SettingsTab_subsectionText">{_t(
                    "Disconnecting from your identity server will mean you " +
                    "won't be discoverable by other users and you won't be " +
                    "able to invite others by email or phone.",
                )}</span>
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
                <Field label={_t("Enter a new identity server")}
                    id="mx_SetIdServer_idServer"
                    type="text"
                    autoComplete="off"
                    placeholder={this.state.defaultIdServer}
                    value={this.state.idServer}
                    onChange={this._onIdentityServerChanged}
                    tooltipContent={this._getTooltip()}
                    tooltipClassName="mx_SetIdServer_tooltip"
                    disabled={this.state.busy}
                    flagInvalid={!!this.state.error}
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
