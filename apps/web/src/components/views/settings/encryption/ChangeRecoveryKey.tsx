/*
 * Copyright 2025 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, useCallback, useState } from "react";
import {
    Breadcrumb,
    Button,
    ErrorMessage,
    Field,
    IconButton,
    Label,
    PasswordControl,
    Root,
    Text,
} from "@vector-im/compound-web";
import CopyIcon from "@vector-im/compound-design-tokens/assets/web/icons/copy";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";
import { logger } from "matrix-js-sdk/src/logger";
import classNames from "classnames";
import { copyPlainTextToClipboard } from "@element-hq/element-web-shared-utils";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import Spinner from "../../elements/Spinner";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { initialiseDehydrationIfEnabled } from "../../../../utils/device/dehydration.ts";
import { withSecretStorageKeyCache } from "../../../../SecurityManager";
import { EncryptionCardButtons } from "./EncryptionCardButtons";
import { logErrorAndShowErrorDialog } from "../../../../utils/ErrorUtils.tsx";
import { DeviceListener, RECOVERY_ACCOUNT_DATA_KEY } from "../../../../device-listener";
import { resetKeyBackupAndWait } from "../../../../utils/crypto/resetKeyBackup";

/**
 * The possible states of the component.
 * - `inform_user`: The user is informed about the recovery key.
 * - `save_key_flow`: A new generated recovery key is displayed to the user and they are asked to save it.
 * - `confirm_key_flow`: The user is asked to confirm the new recovery key.
 */
type State = "inform_user" | "save_key_flow" | "confirm_key_flow";

interface ChangeRecoveryKeyProps {
    /**
     * Whether the user already has a recovery key.
     * This affects some labels (referring to changing the recovery key, versus setting up recovery), and the starting
     * state of component (whether the introductory text is shown or not).
     */
    userHasRecoveryKey: boolean;
    /**
     * Called when the recovery key is successfully changed.
     */
    onFinish: () => void;
    /**
     * Called when the cancel button is clicked or when we go back in the breadcrumbs.
     */
    onCancelClick: () => void;
}

/**
 * The Encryption Settings panel to set up or change the recovery key.
 *
 * A thin wrapper around {@link ChangeRecoveryKeyBody}, just adding breadcrumbs.
 */
export function ChangeRecoveryKey(props: Readonly<ChangeRecoveryKeyProps>): JSX.Element {
    const pages = [
        _t("settings|encryption|title"),
        props.userHasRecoveryKey
            ? _t("settings|encryption|recovery|change_recovery_key")
            : _t("settings|encryption|recovery|set_up_recovery"),
    ];

    // Keep the cancel log line for rageshakes, as the body does for its own cancel button
    const { onCancelClick } = props;
    const onBreadcrumbClick = useCallback(() => {
        logger.debug("ChangeRecoveryKey: user cancelled via the breadcrumbs");
        onCancelClick();
    }, [onCancelClick]);

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onBreadcrumbClick}
                pages={pages}
                onPageClick={onBreadcrumbClick}
            />
            <ChangeRecoveryKeyBody {...props} />
        </>
    );
}

interface ChangeRecoveryKeyBodyProps extends ChangeRecoveryKeyProps {
    /**
     * Extra class name for the card, e.g. `mx_EncryptionCard_noBorder` when shown in a dialog.
     */
    className?: string;
    /**
     * Skip the panel explaining what "recovery" is about, e.g. when the caller has already explained it.
     */
    skipIntroduction?: boolean;
}

/**
 * A component to set up or change the recovery key, without the settings breadcrumbs.
 */
export function ChangeRecoveryKeyBody({
    userHasRecoveryKey,
    onFinish,
    onCancelClick,
    className,
    skipIntroduction = false,
}: Readonly<ChangeRecoveryKeyBodyProps>): JSX.Element | null {
    const matrixClient = useMatrixClientContext();

    // If the user is setting up recovery for the first time, we first show them a panel explaining what
    // "recovery" is about. Otherwise, we jump straight to showing the user the new key.
    const [state, setState] = useState<State>(userHasRecoveryKey || skipIntroduction ? "save_key_flow" : "inform_user");

    const onCancelClickWrapper = useCallback(() => {
        logger.debug("ChangeRecoveryKey: user cancelled");
        onCancelClick();
    }, [onCancelClick]);

    // We create a new recovery key, the recovery key will be displayed to the user
    const recoveryKey = useAsyncMemo(() => matrixClient.getCrypto()!.createRecoveryKeyFromPassphrase(), []);
    // Waiting for the recovery key to be generated
    if (!recoveryKey) return <Spinner />;

    let content: JSX.Element;
    switch (state) {
        case "inform_user":
            // Show a panel explaining what "recovery" is for, and what a recovery key does.
            content = (
                <InformationPanel
                    onContinueClick={() => setState("save_key_flow")}
                    onCancelClick={onCancelClickWrapper}
                />
            );
            break;
        case "save_key_flow":
            // Show a generated recovery key and ask the user to save it.
            content = (
                <KeyPanel
                    // encodedPrivateKey is always defined, the optional typing is incorrect
                    recoveryKey={recoveryKey.encodedPrivateKey!}
                    onConfirmClick={() => setState("confirm_key_flow")}
                    onCancelClick={onCancelClickWrapper}
                />
            );
            break;
        case "confirm_key_flow":
            // Ask the user to enter the recovery key they just saved to confirm it.
            content = (
                <KeyForm
                    expectedKey={recoveryKey.encodedPrivateKey}
                    onCancelClick={onCancelClickWrapper}
                    onSubmit={async () => {
                        const crypto = matrixClient.getCrypto();
                        if (!crypto) return onFinish();

                        try {
                            const deviceListener = DeviceListener.sharedInstance();

                            // we need to call keyStorageOutOfSyncNeedsBackupReset here because
                            // deviceListener.whilePaused() sets its client to undefined, so
                            // keyStorageOutOfSyncNeedsBackupReset won't be able to check
                            // the backup state.
                            const needsBackupReset = await deviceListener.keyStorageOutOfSyncNeedsBackupReset(true);
                            logger.debug(
                                `ChangeRecoveryKey: user confirmed recovery key; now doing change. needsBackupReset: ${needsBackupReset}`,
                            );
                            await deviceListener.whilePaused(async () => {
                                // We need to enable the cache to avoid to prompt the user to enter the new key
                                // when we will try to access the secret storage during the bootstrap
                                await withSecretStorageKeyCache(async () => {
                                    await crypto.bootstrapSecretStorage({
                                        setupNewSecretStorage: true,
                                        createSecretStorageKey: async () => recoveryKey,
                                    });
                                    // Reset the key backup if needed
                                    if (needsBackupReset) {
                                        await resetKeyBackupAndWait(crypto);
                                    }
                                    await initialiseDehydrationIfEnabled(matrixClient, { createNewKey: true });
                                });
                            });

                            // Record the fact that the user explicitly enabled recovery.
                            await matrixClient.setAccountData(RECOVERY_ACCOUNT_DATA_KEY, { enabled: true });

                            onFinish();
                        } catch (e) {
                            logErrorAndShowErrorDialog("Failed to set up secret storage", e);
                        }
                    }}
                    submitButtonLabel={
                        userHasRecoveryKey
                            ? _t("settings|encryption|recovery|change_recovery_confirm_button")
                            : _t("settings|encryption|recovery|set_up_recovery_confirm_button")
                    }
                />
            );
    }

    const labels = getLabels(state, userHasRecoveryKey);

    return (
        <EncryptionCard
            Icon={KeyIcon}
            title={labels.title}
            description={labels.description}
            className={classNames("mx_ChangeRecoveryKey", className)}
        >
            {content}
        </EncryptionCard>
    );
}

type Labels = {
    /**
     * The title of the card.
     */
    title: string;
    /**
     * The description of the card.
     */
    description: string;
};

/**
 * Get the header title and description for the given state.
 * @param state
 */
function getLabels(state: State, userHasRecoveryKey: boolean): Labels {
    switch (state) {
        case "inform_user":
            return {
                title: _t("settings|encryption|recovery|set_up_recovery"),
                description: _t("settings|encryption|recovery|set_up_recovery_description", {
                    changeRecoveryKeyButton: _t("settings|encryption|recovery|change_recovery_key"),
                }),
            };
        case "save_key_flow":
            return userHasRecoveryKey
                ? {
                      title: _t("settings|encryption|recovery|change_recovery_key_title"),
                      description: _t("settings|encryption|recovery|change_recovery_key_description"),
                  }
                : {
                      title: _t("settings|encryption|recovery|set_up_recovery_save_key_title"),
                      description: _t("settings|encryption|recovery|set_up_recovery_save_key_description"),
                  };
        case "confirm_key_flow":
            return userHasRecoveryKey
                ? {
                      title: _t("settings|encryption|recovery|change_recovery_confirm_title"),
                      description: _t("settings|encryption|recovery|change_recovery_confirm_description"),
                  }
                : {
                      title: _t("settings|encryption|recovery|set_up_recovery_confirm_title"),
                      description: _t("settings|encryption|recovery|set_up_recovery_confirm_description"),
                  };
    }
}

interface InformationPanelProps {
    /**
     * Called when the continue button is clicked.
     */
    onContinueClick: MouseEventHandler<HTMLButtonElement>;
    /**
     * Called when the cancel button is clicked.
     */
    onCancelClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * The panel to display information about the recovery key.
 */
function InformationPanel({ onContinueClick, onCancelClick }: InformationPanelProps): JSX.Element {
    return (
        <>
            <Text as="span" weight="medium" className="mx_InformationPanel_description">
                {_t("settings|encryption|recovery|set_up_recovery_secondary_description")}
            </Text>
            <EncryptionCardButtons>
                <Button onClick={onContinueClick}>{_t("action|continue")}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </EncryptionCardButtons>
        </>
    );
}

interface KeyPanelProps {
    /**
     * Called when the confirm button is clicked.
     */
    onConfirmClick: MouseEventHandler;
    /**
     * Called when the cancel button is clicked.
     */
    onCancelClick: MouseEventHandler;
    /**
     * The recovery key to display.
     */
    recoveryKey: string;
}

/**
 * The panel to display the recovery key.
 */
function KeyPanel({ recoveryKey, onConfirmClick, onCancelClick }: KeyPanelProps): JSX.Element {
    return (
        <>
            <div className="mx_KeyPanel">
                <Text as="span" weight="medium">
                    {_t("settings|encryption|recovery|save_key_title")}
                </Text>
                <div>
                    <Text as="span" className="mx_KeyPanel_key" data-testid="recoveryKey">
                        {recoveryKey}
                    </Text>
                    <Text as="span" size="sm">
                        {_t("settings|encryption|recovery|save_key_description")}
                    </Text>
                </div>
                <IconButton
                    aria-label={_t("action|copy")}
                    size="28px"
                    onClick={() => copyPlainTextToClipboard(recoveryKey)}
                >
                    <CopyIcon />
                </IconButton>
            </div>
            <EncryptionCardButtons>
                <Button onClick={onConfirmClick}>{_t("action|continue")}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </EncryptionCardButtons>
        </>
    );
}

interface KeyFormProps {
    /**
     * Called when the cancel button is clicked.
     */
    onCancelClick: MouseEventHandler;
    /**
     * Called with the entered recovery key when the form is submitted.
     * Resolving to `false` marks the entered key as incorrect.
     */
    onSubmit: (recoveryKey: string) => Promise<boolean | void>;
    /**
     * The recovery key the user is expected to enter.
     * If given, the submit button stays disabled until the entered key matches it.
     */
    expectedKey?: string;
    /**
     * The label for the submit button.
     */
    submitButtonLabel: string;
    /**
     * The label for the cancel button. Defaults to "Cancel".
     */
    cancelButtonLabel?: string;
    /**
     * The error shown when the entered key is incorrect.
     */
    errorLabel?: string;
}

/**
 * The form to enter a recovery key.
 * With an `expectedKey`, the submit button is disabled until the entered key matches it.
 * Otherwise the key can only be checked by `onSubmit`, which reports whether it was correct.
 */
export function KeyForm({
    onCancelClick,
    onSubmit,
    expectedKey,
    submitButtonLabel,
    cancelButtonLabel = _t("action|cancel"),
    errorLabel = _t("settings|encryption|recovery|enter_key_error"),
}: KeyFormProps): JSX.Element {
    // Undefined by default, as the key is not filled yet
    const [isKeyValid, setIsKeyValid] = useState<boolean>();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const isKeyInvalidAndFilled = isKeyValid === false;
    const canSubmit = (expectedKey === undefined || isKeyValid) && !isSubmitting;

    // We don't have any file in the form, we can cast it as string safely
    const getFilledKey = (form: HTMLFormElement): string => (new FormData(form).get("recoveryKey") as string).trim();

    return (
        <Root
            className="mx_KeyForm"
            onSubmit={(evt) => {
                evt.preventDefault();
                if (isSubmitting) {
                    // Don't allow repeated attempts.
                    return;
                }
                setIsSubmitting(true);
                void onSubmit(getFilledKey(evt.currentTarget))
                    .then((isCorrect) => {
                        if (isCorrect === false) setIsKeyValid(false);
                    })
                    .finally(() => {
                        setIsSubmitting(false);
                    });
            }}
            onChange={(evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                // Without an expected key, editing only clears the error from the last submission
                setIsKeyValid(expectedKey === undefined ? undefined : getFilledKey(evt.currentTarget) === expectedKey);
            }}
        >
            <Field name="recoveryKey" serverInvalid={isKeyInvalidAndFilled}>
                <Label>{_t("settings|encryption|recovery|enter_recovery_key")}</Label>

                <PasswordControl
                    required={true}
                    title={_t("settings|encryption|recovery|enter_recovery_key")}
                    className="mx_KeyForm_password mx_no_textinput"
                />
                {isKeyInvalidAndFilled && <ErrorMessage>{errorLabel}</ErrorMessage>}
            </Field>
            <EncryptionCardButtons>
                <Button disabled={!canSubmit}>{submitButtonLabel}</Button>
                <Button kind="tertiary" type="button" onClick={onCancelClick}>
                    {cancelButtonLabel}
                </Button>
            </EncryptionCardButtons>
        </Root>
    );
}
