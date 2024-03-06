/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { ClientEvent, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import Spinner from "../elements/Spinner";
import InteractiveAuthDialog from "../dialogs/InteractiveAuthDialog";
import ConfirmDestroyCrossSigningDialog from "../dialogs/security/ConfirmDestroyCrossSigningDialog";
import SetupEncryptionDialog from "../dialogs/security/SetupEncryptionDialog";
import { accessSecretStorage, withSecretStorageKeyCache } from "../../../SecurityManager";
import AccessibleButton from "../elements/AccessibleButton";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IState {
    error: boolean;
    crossSigningPublicKeysOnDevice?: boolean;
    crossSigningPrivateKeysInStorage?: boolean;
    masterPrivateKeyCached?: boolean;
    selfSigningPrivateKeyCached?: boolean;
    userSigningPrivateKeyCached?: boolean;
    homeserverSupportsCrossSigning?: boolean;
    crossSigningReady?: boolean;
}

export default class CrossSigningPanel extends React.PureComponent<{}, IState> {
    private unmounted = false;

    public constructor(props: {}) {
        super(props);

        this.state = {
            error: false,
        };
    }

    public componentDidMount(): void {
        const cli = MatrixClientPeg.safeGet();
        cli.on(ClientEvent.AccountData, this.onAccountData);
        cli.on(CryptoEvent.UserTrustStatusChanged, this.onStatusChanged);
        cli.on(CryptoEvent.KeysChanged, this.onStatusChanged);
        this.getUpdatedStatus();
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        const cli = MatrixClientPeg.get();
        if (!cli) return;
        cli.removeListener(ClientEvent.AccountData, this.onAccountData);
        cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onStatusChanged);
        cli.removeListener(CryptoEvent.KeysChanged, this.onStatusChanged);
    }

    private onAccountData = (event: MatrixEvent): void => {
        const type = event.getType();
        if (type.startsWith("m.cross_signing") || type.startsWith("m.secret_storage")) {
            this.getUpdatedStatus();
        }
    };

    private onBootstrapClick = (): void => {
        if (this.state.crossSigningPrivateKeysInStorage) {
            Modal.createDialog(SetupEncryptionDialog, {}, undefined, /* priority = */ false, /* static = */ true);
        } else {
            // Trigger the flow to set up secure backup, which is what this will do when in
            // the appropriate state.
            accessSecretStorage();
        }
    };

    private onStatusChanged = (): void => {
        this.getUpdatedStatus();
    };

    private async getUpdatedStatus(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        const crypto = cli.getCrypto();
        if (!crypto) return;

        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const crossSigningPublicKeysOnDevice = crossSigningStatus.publicKeysOnDevice;
        const crossSigningPrivateKeysInStorage = crossSigningStatus.privateKeysInSecretStorage;
        const masterPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.masterKey;
        const selfSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.selfSigningKey;
        const userSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.userSigningKey;
        const homeserverSupportsCrossSigning =
            await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing");
        const crossSigningReady = await crypto.isCrossSigningReady();

        this.setState({
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            masterPrivateKeyCached,
            selfSigningPrivateKeyCached,
            userSigningPrivateKeyCached,
            homeserverSupportsCrossSigning,
            crossSigningReady,
        });
    }

    /**
     * Reset the user's cross-signing keys.
     */
    private async resetCrossSigning(): Promise<void> {
        this.setState({ error: false });
        try {
            const cli = MatrixClientPeg.safeGet();
            await withSecretStorageKeyCache(async () => {
                await cli.getCrypto()!.bootstrapCrossSigning({
                    authUploadDeviceSigningKeys: async (makeRequest): Promise<void> => {
                        const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                            title: _t("encryption|bootstrap_title"),
                            matrixClient: cli,
                            makeRequest,
                        });
                        const [confirmed] = await finished;
                        if (!confirmed) {
                            throw new Error("Cross-signing key upload auth canceled");
                        }
                    },
                    setupNewCrossSigning: true,
                });
            });
        } catch (e) {
            this.setState({ error: true });
            logger.error("Error bootstrapping cross-signing", e);
        }
        if (this.unmounted) return;
        this.getUpdatedStatus();
    }

    /**
     * Callback for when the user clicks the "reset cross signing" button.
     *
     * Shows a confirmation dialog, and then does the reset if confirmed.
     */
    private onResetCrossSigningClick = (): void => {
        Modal.createDialog(ConfirmDestroyCrossSigningDialog, {
            onFinished: async (act) => {
                if (!act) return;
                this.resetCrossSigning();
            },
        });
    };

    public render(): React.ReactNode {
        const {
            error,
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            masterPrivateKeyCached,
            selfSigningPrivateKeyCached,
            userSigningPrivateKeyCached,
            homeserverSupportsCrossSigning,
            crossSigningReady,
        } = this.state;

        let errorSection;
        if (error) {
            errorSection = <div className="error">{error.toString()}</div>;
        }

        let summarisedStatus;
        if (homeserverSupportsCrossSigning === undefined) {
            summarisedStatus = <Spinner />;
        } else if (!homeserverSupportsCrossSigning) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    {_t("encryption|cross_signing_unsupported")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningReady && crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    ✅ {_t("encryption|cross_signing_ready")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningReady && !crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    ⚠️ {_t("encryption|cross_signing_ready_no_backup")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    {_t("encryption|cross_signing_untrusted")}
                </SettingsSubsectionText>
            );
        } else {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    {_t("encryption|cross_signing_not_ready")}
                </SettingsSubsectionText>
            );
        }

        const keysExistAnywhere =
            crossSigningPublicKeysOnDevice ||
            crossSigningPrivateKeysInStorage ||
            masterPrivateKeyCached ||
            selfSigningPrivateKeyCached ||
            userSigningPrivateKeyCached;
        const keysExistEverywhere =
            crossSigningPublicKeysOnDevice &&
            crossSigningPrivateKeysInStorage &&
            masterPrivateKeyCached &&
            selfSigningPrivateKeyCached &&
            userSigningPrivateKeyCached;

        const actions: JSX.Element[] = [];

        // TODO: determine how better to expose this to users in addition to prompts at login/toast
        if (!keysExistEverywhere && homeserverSupportsCrossSigning) {
            let buttonCaption = _t("encryption|set_up_toast_title");
            if (crossSigningPrivateKeysInStorage) {
                buttonCaption = _t("encryption|verify_toast_title");
            }
            actions.push(
                <AccessibleButton key="setup" kind="primary_outline" onClick={this.onBootstrapClick}>
                    {buttonCaption}
                </AccessibleButton>,
            );
        }

        if (keysExistAnywhere) {
            actions.push(
                <AccessibleButton key="reset" kind="danger_outline" onClick={this.onResetCrossSigningClick}>
                    {_t("action|reset")}
                </AccessibleButton>,
            );
        }

        let actionRow;
        if (actions.length) {
            actionRow = <div className="mx_CrossSigningPanel_buttonRow">{actions}</div>;
        }

        return (
            <>
                {summarisedStatus}
                <details>
                    <summary className="mx_CrossSigningPanel_advanced">{_t("common|advanced")}</summary>
                    <table className="mx_CrossSigningPanel_statusList">
                        <tbody>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_public_keys")}</th>
                                <td>
                                    {crossSigningPublicKeysOnDevice
                                        ? _t("settings|security|cross_signing_in_memory")
                                        : _t("settings|security|cross_signing_not_found")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_private_keys")}</th>
                                <td>
                                    {crossSigningPrivateKeysInStorage
                                        ? _t("settings|security|cross_signing_in_4s")
                                        : _t("settings|security|cross_signing_not_in_4s")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_master_private_Key")}</th>
                                <td>
                                    {masterPrivateKeyCached
                                        ? _t("settings|security|cross_signing_cached")
                                        : _t("settings|security|cross_signing_not_cached")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_self_signing_private_key")}</th>
                                <td>
                                    {selfSigningPrivateKeyCached
                                        ? _t("settings|security|cross_signing_cached")
                                        : _t("settings|security|cross_signing_not_cached")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_user_signing_private_key")}</th>
                                <td>
                                    {userSigningPrivateKeyCached
                                        ? _t("settings|security|cross_signing_cached")
                                        : _t("settings|security|cross_signing_not_cached")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("settings|security|cross_signing_homeserver_support")}</th>
                                <td>
                                    {homeserverSupportsCrossSigning
                                        ? _t("settings|security|cross_signing_homeserver_support_exists")
                                        : _t("settings|security|cross_signing_not_found")}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </details>
                {errorSection}
                {actionRow}
            </>
        );
    }
}
