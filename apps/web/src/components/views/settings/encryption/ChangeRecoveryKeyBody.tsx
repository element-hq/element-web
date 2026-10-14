/*
 * Copyright 2025 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, useCallback, useState } from "react";
import { Button, ErrorMessage, Field, IconButton, Label, PasswordControl, Root, Text } from "@vector-im/compound-web";
import CopyIcon from "@vector-im/compound-design-tokens/assets/web/icons/copy";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";
import { logger } from "matrix-js-sdk/src/logger";
import classNames from "classnames";
import { copyPlainTextToClipboard } from "@element-hq/element-web-shared-utils";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
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
 * - `save_key_flow`: A new generated recovery key is displayed to the user and they are asked to save it.
 * - `confirm_key_flow`: The user is asked to confirm the new recovery key.
 */
type State = "save_key_flow" | "confirm_key_flow";

interface ChangeRecoveryKeyBodyProps {
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
     * Called when the cancel button is clicked.
     */
    onCancelClick: () => void;
    /**
     * Extra class name for the card, e.g. `mx_EncryptionCard_noBorder` when shown in a dialog.
     */
    className?: string;
}

/**
 * A component to set up or change the recovery key, without the settings breadcrumbs.
 * {@link ChangeRecoveryKey} wraps it for the Encryption Settings panel.
 */
export function ChangeRecoveryKeyBody({
    userHasRecoveryKey,
    onFinish,
    onCancelClick,
    className,
}: Readonly<ChangeRecoveryKeyBodyProps>): JSX.Element | null {
    const matrixClient = useMatrixClientContext();

    const [state, setState] = useState<State>("save_key_flow");

    const onCancelClickWrapper = useCallback(() => {
        logger.debug("ChangeRecoveryKey: user cancelled");
        onCancelClick();
    }, [onCancelClick]);

    // We create a new recovery key, the recovery key will be displayed to the user
    const recoveryKey = useAsyncMemo(() => matrixClient.getCrypto()!.createRecoveryKeyFromPassphrase(), []);
    // Waiting for the recovery key to be generated
    if (!recoveryKey) return null;

    let content: JSX.Element;
    switch (state) {
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
                    // encodedPrivateKey is always defined, the optional typing is incorrect
                    recoveryKey={recoveryKey.encodedPrivateKey!}
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
     * Called when the form is submitted.
     */
    onSubmit: () => Promise<void>;
    /**
     * The recovery key to confirm.
     */
    recoveryKey: string;
    /**
     * The label for the submit button.
     */
    submitButtonLabel: string;
}

/**
 * The form to confirm the recovery key.
 * The finish button is disabled until the key is filled and valid.
 * The entered key is valid if it matches the recovery key.
 */
function KeyForm({ onCancelClick, onSubmit, recoveryKey, submitButtonLabel }: KeyFormProps): JSX.Element {
    // Undefined by default, as the key is not filled yet
    const [isKeyValid, setIsKeyValid] = useState<boolean>();
    const [isKeyChangeInProgress, setIsKeyChangeInProgress] = useState<boolean>(false);
    const isKeyInvalidAndFilled = isKeyValid === false;

    return (
        <Root
            className="mx_KeyForm"
            onSubmit={(evt) => {
                evt.preventDefault();
                if (isKeyChangeInProgress) {
                    // Don't allow repeated attempts.
                    return;
                }
                setIsKeyChangeInProgress(true);
                void onSubmit().finally(() => {
                    setIsKeyChangeInProgress(false);
                });
            }}
            onChange={async (evt) => {
                evt.preventDefault();
                evt.stopPropagation();

                // We don't have any file in the form, we can cast it as string safely
                const filledKey = new FormData(evt.currentTarget).get("recoveryKey") as string | "";
                setIsKeyValid(filledKey.trim() === recoveryKey);
            }}
        >
            <Field name="recoveryKey" serverInvalid={isKeyInvalidAndFilled}>
                <Label>{_t("settings|encryption|recovery|enter_recovery_key")}</Label>

                <PasswordControl
                    required={true}
                    title={_t("settings|encryption|recovery|enter_recovery_key")}
                    className="mx_KeyForm_password mx_no_textinput"
                />
                {isKeyInvalidAndFilled && (
                    <ErrorMessage>{_t("settings|encryption|recovery|enter_key_error")}</ErrorMessage>
                )}
            </Field>
            <EncryptionCardButtons>
                <Button disabled={!isKeyValid || isKeyChangeInProgress}>{submitButtonLabel}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </EncryptionCardButtons>
        </Root>
    );
}
