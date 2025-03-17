/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type FormEventHandler, type JSX, type MouseEventHandler, useState } from "react";
import {
    Breadcrumb,
    Button,
    ErrorMessage,
    Field,
    IconButton,
    Label,
    Root,
    Text,
    TextControl,
} from "@vector-im/compound-web";
import CopyIcon from "@vector-im/compound-design-tokens/assets/web/icons/copy";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { copyPlaintext } from "../../../../utils/strings";
import { initialiseDehydrationIfEnabled } from "../../../../utils/device/dehydration.ts";
import { withSecretStorageKeyCache } from "../../../../SecurityManager";
import { EncryptionCardButtons } from "./EncryptionCardButtons";
import { logErrorAndShowErrorDialog } from "../../../../utils/ErrorUtils.tsx";

/**
 * The possible states of the component.
 * - `inform_user`: The user is informed about the recovery key.
 * - `save_key_setup_flow`: The user is asked to save the new recovery key during the setup flow.
 * - `save_key_change_flow`: The user is asked to save the new recovery key during the change key flow.
 * - `confirm_key_setup_flow`: The user is asked to confirm the new recovery key during the set up flow.
 * - `confirm_key_change_flow`: The user is asked to confirm the new recovery key during the change key flow.
 */
type State =
    | "inform_user"
    | "save_key_setup_flow"
    | "save_key_change_flow"
    | "confirm_key_setup_flow"
    | "confirm_key_change_flow";

interface ChangeRecoveryKeyProps {
    /**
     * If true, the component will display the flow to change the recovery key.
     * If false,the component will display the flow to set up a new recovery key.
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
 * A component to set up or change the recovery key.
 */
export function ChangeRecoveryKey({
    userHasRecoveryKey,
    onFinish,
    onCancelClick,
}: ChangeRecoveryKeyProps): JSX.Element | null {
    const matrixClient = useMatrixClientContext();

    // If the user is setting up recovery for the first time, we first show them a panel explaining what
    // "recovery" is about. Otherwise, we jump straight to showing the user the new key.
    const [state, setState] = useState<State>(userHasRecoveryKey ? "save_key_change_flow" : "inform_user");

    // We create a new recovery key, the recovery key will be displayed to the user
    const recoveryKey = useAsyncMemo(() => matrixClient.getCrypto()!.createRecoveryKeyFromPassphrase(), []);
    // Waiting for the recovery key to be generated
    if (!recoveryKey) return null;

    let content: JSX.Element;
    switch (state) {
        case "inform_user":
            // Show a panel explaining what "recovery" is for, and what a recovery key does.
            content = (
                <InformationPanel
                    onContinueClick={() => setState("save_key_setup_flow")}
                    onCancelClick={onCancelClick}
                />
            );
            break;
        case "save_key_setup_flow":
        case "save_key_change_flow":
            // Show a generated recovery key and ask the user to save it.
            content = (
                <KeyPanel
                    // encodedPrivateKey is always defined, the optional typing is incorrect
                    recoveryKey={recoveryKey.encodedPrivateKey!}
                    onConfirmClick={() =>
                        setState((currentState) =>
                            currentState === "save_key_change_flow"
                                ? "confirm_key_change_flow"
                                : "confirm_key_setup_flow",
                        )
                    }
                    onCancelClick={onCancelClick}
                />
            );
            break;
        case "confirm_key_setup_flow":
        case "confirm_key_change_flow":
            // Ask the user to enter the recovery key they just saved to confirm it.
            content = (
                <KeyForm
                    // encodedPrivateKey is always defined, the optional typing is incorrect
                    recoveryKey={recoveryKey.encodedPrivateKey!}
                    onCancelClick={onCancelClick}
                    onSubmit={async () => {
                        const crypto = matrixClient.getCrypto();
                        if (!crypto) return onFinish();

                        try {
                            // We need to enable the cache to avoid to prompt the user to enter the new key
                            // when we will try to access the secret storage during the bootstrap
                            await withSecretStorageKeyCache(async () => {
                                await crypto.bootstrapSecretStorage({
                                    setupNewSecretStorage: true,
                                    createSecretStorageKey: async () => recoveryKey,
                                });
                                await initialiseDehydrationIfEnabled(matrixClient, { createNewKey: true });
                            });
                            onFinish();
                        } catch (e) {
                            logErrorAndShowErrorDialog("Failed to set up secret storage", e);
                        }
                    }}
                    submitButtonLabel={
                        state === "confirm_key_setup_flow"
                            ? _t("settings|encryption|recovery|set_up_recovery_confirm_button")
                            : _t("settings|encryption|recovery|change_recovery_confirm_button")
                    }
                />
            );
    }

    const pages = [
        _t("settings|encryption|title"),
        userHasRecoveryKey
            ? _t("settings|encryption|recovery|change_recovery_key")
            : _t("settings|encryption|recovery|set_up_recovery"),
    ];
    const labels = getLabels(state);

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onCancelClick}
                pages={pages}
                onPageClick={onCancelClick}
            />
            <EncryptionCard
                Icon={KeyIcon}
                title={labels.title}
                description={labels.description}
                className="mx_ChangeRecoveryKey"
            >
                {content}
            </EncryptionCard>
        </>
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
function getLabels(state: State): Labels {
    switch (state) {
        case "inform_user":
            return {
                title: _t("settings|encryption|recovery|set_up_recovery"),
                description: _t("settings|encryption|recovery|set_up_recovery_description", {
                    changeRecoveryKeyButton: _t("settings|encryption|recovery|change_recovery_key"),
                }),
            };
        case "save_key_setup_flow":
            return {
                title: _t("settings|encryption|recovery|set_up_recovery_save_key_title"),
                description: _t("settings|encryption|recovery|set_up_recovery_save_key_description"),
            };
        case "save_key_change_flow":
            return {
                title: _t("settings|encryption|recovery|change_recovery_key_title"),
                description: _t("settings|encryption|recovery|change_recovery_key_description"),
            };
        case "confirm_key_setup_flow":
            return {
                title: _t("settings|encryption|recovery|set_up_recovery_confirm_title"),
                description: _t("settings|encryption|recovery|set_up_recovery_confirm_description"),
            };
        case "confirm_key_change_flow":
            return {
                title: _t("settings|encryption|recovery|change_recovery_confirm_title"),
                description: _t("settings|encryption|recovery|change_recovery_confirm_description"),
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
                <IconButton aria-label={_t("action|copy")} size="28px" onClick={() => copyPlaintext(recoveryKey)}>
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
    onSubmit: FormEventHandler;
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
    const isKeyInvalidAndFilled = isKeyValid === false;

    return (
        <Root
            className="mx_KeyForm"
            onSubmit={(evt) => {
                evt.preventDefault();
                onSubmit(evt);
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

                <TextControl required={true} />
                {isKeyInvalidAndFilled && (
                    <ErrorMessage>{_t("settings|encryption|recovery|enter_key_error")}</ErrorMessage>
                )}
            </Field>
            <EncryptionCardButtons>
                <Button disabled={!isKeyValid}>{submitButtonLabel}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </EncryptionCardButtons>
        </Root>
    );
}
