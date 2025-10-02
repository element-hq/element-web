/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type KeyBackupInfo, type VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import DevicesIcon from "@vector-im/compound-design-tokens/assets/web/icons/devices";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-solid";
import { Button } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import VerificationRequestDialog from "../../views/dialogs/VerificationRequestDialog";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import EncryptionPanel from "../../views/right_panel/EncryptionPanel";
import AccessibleButton from "../../views/elements/AccessibleButton";
import Spinner from "../../views/elements/Spinner";
import { ResetIdentityDialog } from "../../views/dialogs/ResetIdentityDialog";
import { EncryptionCard } from "../../views/settings/encryption/EncryptionCard";
import { EncryptionCardButtons } from "../../views/settings/encryption/EncryptionCardButtons";
import { EncryptionCardEmphasisedContent } from "../../views/settings/encryption/EncryptionCardEmphasisedContent";
import ExternalLink from "../../views/elements/ExternalLink";
import dispatcher from "../../../dispatcher/dispatcher";

interface IProps {
    onFinished: () => void;
    /**
     * Offer the user an option to log out, instead of setting up encryption.
     *
     * This is used when this component is shown when the user is initially
     * prompted to set up encryption, before the user is shown the main chat
     * interface.
     *
     * Defaults to `false` if omitted.
     */
    allowLogout?: boolean;
}

interface IState {
    phase?: Phase;
    verificationRequest: VerificationRequest | null;
    backupInfo: KeyBackupInfo | null;
}

/**
 * Component to set up encryption by verifying the current device.
 */
export default class SetupEncryptionBody extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        const store = SetupEncryptionStore.sharedInstance();
        store.start();
        this.state = {
            phase: store.phase,
            // this serves dual purpose as the object for the request logic and
            // the presence of it indicating that we're in 'verify mode'.
            // Because of the latter, it lives in the state.
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
        };
    }

    public componentDidMount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this.onStoreUpdate);
    }

    private onStoreUpdate = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        if (store.phase === Phase.Finished) {
            this.props.onFinished();
            return;
        }
        this.setState({
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
        });
    };

    public componentWillUnmount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this.onStoreUpdate);
        store.stop();
    }

    private onUsePassphraseClick = async (): Promise<void> => {
        const store = SetupEncryptionStore.sharedInstance();
        store.usePassPhrase();
    };

    private onVerifyClick = (): void => {
        const cli = MatrixClientPeg.safeGet();
        const userId = cli.getSafeUserId();
        const requestPromise = cli.getCrypto()!.requestOwnUserVerification();

        // We need to call onFinished now to close this dialog, and
        // again later to signal that the verification is complete.
        this.props.onFinished();
        const { finished: verificationFinished } = Modal.createDialog(VerificationRequestDialog, {
            verificationRequestPromise: requestPromise,
            member: cli.getUser(userId) ?? undefined,
        });

        verificationFinished.then(async () => {
            const request = await requestPromise;
            request.cancel();
            this.props.onFinished();
        });
    };

    private onSkipConfirmClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skipConfirm();
    };

    private onSkipBackClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.returnAfterSkip();
    };

    private onCantConfirmClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        Modal.createDialog(ResetIdentityDialog, {
            onReset: () => {
                // The user completed the reset process - close this dialog
                this.props.onFinished();
                const store = SetupEncryptionStore.sharedInstance();
                store.done();
            },
            variant: store.lostKeys() ? "no_verification_method" : "confirm",
        });
    };

    private onSignOutClick = (): void => {
        dispatcher.dispatch({ action: "logout" });
    };

    private onDoneClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.done();
    };

    private onEncryptionPanelClose = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        const cli = MatrixClientPeg.safeGet();
        const { phase } = this.state;

        if (this.state.verificationRequest && cli.getUser(this.state.verificationRequest.otherUserId)) {
            return (
                <EncryptionPanel
                    layout="dialog"
                    verificationRequest={this.state.verificationRequest}
                    onClose={this.onEncryptionPanelClose}
                    member={cli.getUser(this.state.verificationRequest.otherUserId)!}
                    isRoomEncrypted={false}
                />
            );
        } else if (phase === Phase.Intro) {
            const store = SetupEncryptionStore.sharedInstance();

            let verifyButton;
            if (store.hasDevicesToVerifyAgainst) {
                verifyButton = (
                    <Button kind="primary" onClick={this.onVerifyClick}>
                        <DevicesIcon /> {_t("encryption|verification|use_another_device")}
                    </Button>
                );
            }

            let useRecoveryKeyButton;
            if (store.keyInfo) {
                useRecoveryKeyButton = (
                    <Button kind="primary" onClick={this.onUsePassphraseClick}>
                        {_t("encryption|verification|use_recovery_key")}
                    </Button>
                );
            }

            let signOutButton;
            if (this.props.allowLogout) {
                signOutButton = (
                    <Button kind="tertiary" onClick={this.onSignOutClick}>
                        {_t("action|sign_out")}
                    </Button>
                );
            }

            return (
                <EncryptionCard
                    title={_t("encryption|verification|confirm_identity_title")}
                    Icon={LockIcon}
                    className="mx_EncryptionCard_noBorder mx_SetupEncryptionBody"
                >
                    <EncryptionCardEmphasisedContent>
                        <span>{_t("encryption|verification|confirm_identity_description")}</span>
                        <span>
                            <ExternalLink href="https://element.io/help#encryption-device-verification">
                                {_t("action|learn_more")}
                            </ExternalLink>
                        </span>
                    </EncryptionCardEmphasisedContent>
                    <EncryptionCardButtons>
                        {verifyButton}
                        {useRecoveryKeyButton}
                        <Button kind="secondary" onClick={this.onCantConfirmClick}>
                            {_t("encryption|verification|cant_confirm")}
                        </Button>
                        {signOutButton}
                    </EncryptionCardButtons>
                </EncryptionCard>
            );
        } else if (phase === Phase.Done) {
            let message: JSX.Element;
            if (this.state.backupInfo) {
                message = <p>{_t("encryption|verification|verification_success_with_backup")}</p>;
            } else {
                message = <p>{_t("encryption|verification|verification_success_without_backup")}</p>;
            }
            return (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified" />
                    {message}
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="primary" onClick={this.onDoneClick}>
                            {_t("action|done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmSkip) {
            return (
                <div>
                    <p>{_t("encryption|verification|verification_skip_warning")}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="danger_outline" onClick={this.onSkipConfirmClick}>
                            {_t("encryption|verification|verify_later")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onSkipBackClick}>
                            {_t("action|go_back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.Busy || phase === Phase.Loading) {
            return <Spinner />;
        } else {
            logger.log(`SetupEncryptionBody: Unknown phase ${phase}`);
        }
    }
}
