/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { IThreepid } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { getThreepidsWithBindStatus } from "../../../boundThreepids";
import IdentityAuthClient from "../../../IdentityAuthClient";
import { abbreviateUrl, parseUrl, unabbreviateUrl } from "../../../utils/UrlUtils";
import { getDefaultIdentityServerUrl, doesIdentityServerHaveTerms } from "../../../utils/IdentityServerUtils";
import { timeout } from "../../../utils/promise";
import { ActionPayload } from "../../../dispatcher/payloads";
import InlineSpinner from "../elements/InlineSpinner";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import QuestionDialog from "../dialogs/QuestionDialog";
import SettingsFieldset from "./SettingsFieldset";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

// We'll wait up to this long when checking for 3PID bindings on the IS.
const REACHABILITY_TIMEOUT = 10000; // ms

/**
 * Check an IS URL is valid, including liveness check
 *
 * @param {string} u The url to check
 * @returns {string} null if url passes all checks, otherwise i18ned error string
 */
async function checkIdentityServerUrl(u: string): Promise<string | null> {
    const parsedUrl = parseUrl(u);

    if (parsedUrl.protocol !== "https:") return _t("identity_server|url_not_https");

    // XXX: duplicated logic from js-sdk but it's quite tied up in the validation logic in the
    // js-sdk so probably as easy to duplicate it than to separate it out so we can reuse it
    try {
        const response = await fetch(u + "/_matrix/identity/v2");
        if (response.ok) {
            return null;
        } else if (response.status < 200 || response.status >= 300) {
            return _t("identity_server|error_invalid", { code: response.status });
        } else {
            return _t("identity_server|error_connection");
        }
    } catch (e) {
        return _t("identity_server|error_connection");
    }
}

interface IProps {
    // Whether or not the identity server is missing terms. This affects the text
    // shown to the user.
    missingTerms: boolean;
}

interface IState {
    defaultIdServer?: string;
    currentClientIdServer?: string;
    idServer: string;
    error?: string;
    busy: boolean;
    disconnectBusy: boolean;
    checking: boolean;
}

export default class SetIdServer extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        let defaultIdServer = "";
        if (!MatrixClientPeg.safeGet().getIdentityServerUrl() && getDefaultIdentityServerUrl()) {
            // If no identity server is configured but there's one in the config, prepopulate
            // the field to help the user.
            defaultIdServer = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.state = {
            defaultIdServer,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
            idServer: "",
            busy: false,
            disconnectBusy: false,
            checking: false,
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        // We react to changes in the identity server in the event the user is staring at this form
        // when changing their identity server on another device.
        if (payload.action !== "id_server_changed") return;

        this.setState({
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
        });
    };

    private onIdentityServerChanged = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const u = ev.target.value;

        this.setState({ idServer: u });
    };

    private getTooltip = (): ReactNode => {
        if (this.state.checking) {
            return (
                <div>
                    <InlineSpinner />
                    {_t("identity_server|checking")}
                </div>
            );
        } else if (this.state.error) {
            return <strong className="warning">{this.state.error}</strong>;
        } else {
            return null;
        }
    };

    private idServerChangeEnabled = (): boolean => {
        return !!this.state.idServer && !this.state.busy;
    };

    private saveIdServer = (fullUrl: string): void => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.safeGet().setAccountData("m.identity_server", {
            base_url: fullUrl,
        });
        this.setState({
            busy: false,
            error: undefined,
            currentClientIdServer: fullUrl,
            idServer: "",
        });
    };

    private checkIdServer = async (e: React.SyntheticEvent): Promise<void> => {
        e.preventDefault();
        const { idServer, currentClientIdServer } = this.state;

        this.setState({ busy: true, checking: true, error: undefined });

        const fullUrl = unabbreviateUrl(idServer);

        let errStr = await checkIdentityServerUrl(fullUrl);
        if (!errStr) {
            try {
                this.setState({ checking: false }); // clear tooltip

                // Test the identity server by trying to register with it. This
                // may result in a terms of service prompt.
                const authClient = new IdentityAuthClient(fullUrl);
                await authClient.getAccessToken();

                let save = true;

                // Double check that the identity server even has terms of service.
                const hasTerms = await doesIdentityServerHaveTerms(MatrixClientPeg.safeGet(), fullUrl);
                if (!hasTerms) {
                    const [confirmed] = await this.showNoTermsWarning(fullUrl);
                    save = !!confirmed;
                }

                // Show a general warning, possibly with details about any bound
                // 3PIDs that would be left behind.
                if (save && currentClientIdServer && fullUrl !== currentClientIdServer) {
                    const [confirmed] = await this.showServerChangeWarning({
                        title: _t("identity_server|change"),
                        unboundMessage: _t(
                            "identity_server|change_prompt",
                            {},
                            {
                                current: (sub) => <b>{abbreviateUrl(currentClientIdServer)}</b>,
                                new: (sub) => <b>{abbreviateUrl(idServer)}</b>,
                            },
                        ),
                        button: _t("action|continue"),
                    });
                    save = !!confirmed;
                }

                if (save) {
                    this.saveIdServer(fullUrl);
                }
            } catch (e) {
                logger.error(e);
                errStr = _t("identity_server|error_invalid_or_terms");
            }
        }
        this.setState({
            busy: false,
            checking: false,
            error: errStr ?? undefined,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
        });
    };

    private showNoTermsWarning(fullUrl: string): Promise<[ok?: boolean]> {
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("terms|identity_server_no_terms_title"),
            description: (
                <div>
                    <strong className="warning">{_t("identity_server|no_terms")}</strong>
                    <span>&nbsp;{_t("terms|identity_server_no_terms_description_2")}</span>
                </div>
            ),
            button: _t("action|continue"),
        });
        return finished;
    }

    private onDisconnectClicked = async (): Promise<void> => {
        this.setState({ disconnectBusy: true });
        try {
            const [confirmed] = await this.showServerChangeWarning({
                title: _t("identity_server|disconnect"),
                unboundMessage: _t(
                    "identity_server|disconnect_server",
                    {},
                    { idserver: (sub) => <b>{abbreviateUrl(this.state.currentClientIdServer)}</b> },
                ),
                button: _t("action|disconnect"),
            });
            if (confirmed) {
                this.disconnectIdServer();
            }
        } finally {
            this.setState({ disconnectBusy: false });
        }
    };

    private async showServerChangeWarning({
        title,
        unboundMessage,
        button,
    }: {
        title: string;
        unboundMessage: ReactNode;
        button: string;
    }): Promise<[ok?: boolean]> {
        const { currentClientIdServer } = this.state;

        let threepids: IThreepid[] = [];
        let currentServerReachable = true;
        try {
            threepids = await timeout(
                getThreepidsWithBindStatus(MatrixClientPeg.safeGet()),
                Promise.reject(new Error("Timeout attempting to reach identity server")),
                REACHABILITY_TIMEOUT,
            );
        } catch (e) {
            currentServerReachable = false;
            logger.warn(
                `Unable to reach identity server at ${currentClientIdServer} to check ` +
                    `for 3PIDs during IS change flow`,
            );
            logger.warn(e);
        }
        const boundThreepids = threepids.filter((tp) => tp.bound);
        let message;
        let danger = false;
        const messageElements = {
            idserver: (sub: string) => <b>{abbreviateUrl(currentClientIdServer)}</b>,
            b: (sub: string) => <b>{sub}</b>,
        };
        if (!currentServerReachable) {
            message = (
                <div>
                    <p>{_t("identity_server|disconnect_offline_warning", {}, messageElements)}</p>
                    <p>{_t("identity_server|suggestions")}</p>
                    <ul>
                        <li>{_t("identity_server|suggestions_1")}</li>
                        <li>
                            {_t(
                                "identity_server|suggestions_2",
                                {},
                                {
                                    idserver: messageElements.idserver,
                                },
                            )}
                        </li>
                        <li>{_t("identity_server|suggestions_3")}</li>
                    </ul>
                </div>
            );
            danger = true;
            button = _t("identity_server|disconnect_anyway");
        } else if (boundThreepids.length) {
            message = (
                <div>
                    <p>{_t("identity_server|disconnect_personal_data_warning_1", {}, messageElements)}</p>
                    <p>{_t("identity_server|disconnect_personal_data_warning_2")}</p>
                </div>
            );
            danger = true;
            button = _t("identity_server|disconnect_anyway");
        } else {
            message = unboundMessage;
        }

        const { finished } = Modal.createDialog(QuestionDialog, {
            title,
            description: message,
            button,
            cancelButton: _t("action|go_back"),
            danger,
        });
        return finished;
    }

    private disconnectIdServer = (): void => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.safeGet().setAccountData("m.identity_server", {
            base_url: null, // clear
        });

        let newFieldVal = "";
        if (getDefaultIdentityServerUrl()) {
            // Prepopulate the client's default so the user at least has some idea of
            // a valid value they might enter
            newFieldVal = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.setState({
            busy: false,
            error: undefined,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
            idServer: newFieldVal,
        });
    };

    public render(): React.ReactNode {
        const idServerUrl = this.state.currentClientIdServer;
        let sectionTitle;
        let bodyText;
        if (idServerUrl) {
            sectionTitle = _t("identity_server|url", { server: abbreviateUrl(idServerUrl) });
            bodyText = _t(
                "identity_server|description_connected",
                {},
                { server: (sub) => <b>{abbreviateUrl(idServerUrl)}</b> },
            );
            if (this.props.missingTerms) {
                bodyText = _t(
                    "identity_server|change_server_prompt",
                    {},
                    { server: (sub) => <b>{abbreviateUrl(idServerUrl)}</b> },
                );
            }
        } else {
            sectionTitle = _t("common|identity_server");
            bodyText = _t("identity_server|description_disconnected");
        }

        let discoSection;
        if (idServerUrl) {
            let discoButtonContent: React.ReactNode = _t("action|disconnect");
            let discoBodyText = _t("identity_server|disconnect_warning");
            if (this.props.missingTerms) {
                discoBodyText = _t("identity_server|description_optional");
                discoButtonContent = _t("identity_server|do_not_use");
            }
            if (this.state.disconnectBusy) {
                discoButtonContent = <InlineSpinner />;
            }
            discoSection = (
                <>
                    <SettingsSubsectionText>{discoBodyText}</SettingsSubsectionText>
                    <AccessibleButton onClick={this.onDisconnectClicked} kind="danger_sm">
                        {discoButtonContent}
                    </AccessibleButton>
                </>
            );
        }

        return (
            <SettingsFieldset legend={sectionTitle} description={bodyText}>
                <form className="mx_SetIdServer" onSubmit={this.checkIdServer}>
                    <Field
                        label={_t("identity_server|url_field_label")}
                        type="text"
                        autoComplete="off"
                        placeholder={this.state.defaultIdServer}
                        value={this.state.idServer}
                        onChange={this.onIdentityServerChanged}
                        tooltipContent={this.getTooltip()}
                        tooltipClassName="mx_SetIdServer_tooltip"
                        disabled={this.state.busy}
                        forceValidity={this.state.error ? false : undefined}
                    />
                    <AccessibleButton
                        type="submit"
                        kind="primary_sm"
                        onClick={this.checkIdServer}
                        disabled={!this.idServerChangeEnabled()}
                    >
                        {_t("action|change")}
                    </AccessibleButton>
                    {discoSection}
                </form>
            </SettingsFieldset>
        );
    }
}
