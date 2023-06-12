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
import { accessSecretStorage } from "../../../SecurityManager";
import AccessibleButton from "../elements/AccessibleButton";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IState {
    error?: Error;
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

        this.state = {};
    }

    public componentDidMount(): void {
        const cli = MatrixClientPeg.get();
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
        const cli = MatrixClientPeg.get();
        const crypto = cli.getCrypto();
        if (!crypto) return;

        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const crossSigningPublicKeysOnDevice = crossSigningStatus.publicKeysOnDevice;
        const crossSigningPrivateKeysInStorage = crossSigningStatus.privateKeysInSecretStorage;
        const masterPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.masterKey;
        const selfSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.selfSigningKey;
        const userSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.userSigningKey;
        const homeserverSupportsCrossSigning = await cli.doesServerSupportUnstableFeature(
            "org.matrix.e2e_cross_signing",
        );
        const crossSigningReady = await cli.isCrossSigningReady();

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
     * Bootstrapping cross-signing take one of these paths:
     * 1. Create cross-signing keys locally and store in secret storage (if it
     *    already exists on the account).
     * 2. Access existing secret storage by requesting passphrase and accessing
     *    cross-signing keys as needed.
     * 3. All keys are loaded and there's nothing to do.
     * @param {bool} [forceReset] Bootstrap again even if keys already present
     */
    private bootstrapCrossSigning = async ({ forceReset = false }): Promise<void> => {
        this.setState({ error: undefined });
        try {
            const cli = MatrixClientPeg.get();
            await cli.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (makeRequest): Promise<void> => {
                    const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                        title: _t("Setting up keys"),
                        matrixClient: cli,
                        makeRequest,
                    });
                    const [confirmed] = await finished;
                    if (!confirmed) {
                        throw new Error("Cross-signing key upload auth canceled");
                    }
                },
                setupNewCrossSigning: forceReset,
            });
        } catch (e) {
            this.setState({ error: e });
            logger.error("Error bootstrapping cross-signing", e);
        }
        if (this.unmounted) return;
        this.getUpdatedStatus();
    };

    private resetCrossSigning = (): void => {
        Modal.createDialog(ConfirmDestroyCrossSigningDialog, {
            onFinished: (act) => {
                if (!act) return;
                this.bootstrapCrossSigning({ forceReset: true });
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
                    {_t("Your homeserver does not support cross-signing.")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningReady && crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    ✅ {_t("Cross-signing is ready for use.")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningReady && !crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    ⚠️ {_t("Cross-signing is ready but keys are not backed up.")}
                </SettingsSubsectionText>
            );
        } else if (crossSigningPrivateKeysInStorage) {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    {_t(
                        "Your account has a cross-signing identity in secret storage, " +
                            "but it is not yet trusted by this session.",
                    )}
                </SettingsSubsectionText>
            );
        } else {
            summarisedStatus = (
                <SettingsSubsectionText data-testid="summarised-status">
                    {_t("Cross-signing is not set up.")}
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
            let buttonCaption = _t("Set up Secure Backup");
            if (crossSigningPrivateKeysInStorage) {
                buttonCaption = _t("Verify this session");
            }
            actions.push(
                <AccessibleButton key="setup" kind="primary" onClick={this.onBootstrapClick}>
                    {buttonCaption}
                </AccessibleButton>,
            );
        }

        if (keysExistAnywhere) {
            actions.push(
                <AccessibleButton key="reset" kind="danger" onClick={this.resetCrossSigning}>
                    {_t("Reset")}
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
                    <summary>{_t("Advanced")}</summary>
                    <table className="mx_CrossSigningPanel_statusList">
                        <tr>
                            <th scope="row">{_t("Cross-signing public keys:")}</th>
                            <td>{crossSigningPublicKeysOnDevice ? _t("in memory") : _t("not found")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Cross-signing private keys:")}</th>
                            <td>
                                {crossSigningPrivateKeysInStorage
                                    ? _t("in secret storage")
                                    : _t("not found in storage")}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Master private key:")}</th>
                            <td>{masterPrivateKeyCached ? _t("cached locally") : _t("not found locally")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Self signing private key:")}</th>
                            <td>{selfSigningPrivateKeyCached ? _t("cached locally") : _t("not found locally")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("User signing private key:")}</th>
                            <td>{userSigningPrivateKeyCached ? _t("cached locally") : _t("not found locally")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Homeserver feature support:")}</th>
                            <td>{homeserverSupportsCrossSigning ? _t("exists") : _t("not found")}</td>
                        </tr>
                    </table>
                </details>
                {errorSection}
                {actionRow}
            </>
        );
    }
}
