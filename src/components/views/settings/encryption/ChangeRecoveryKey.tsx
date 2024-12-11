/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { FormEventHandler, JSX, MouseEventHandler, useState } from "react";
import {
    Breadcrumb,
    IconButton,
    Button,
    Root,
    TextControl,
    Field,
    Label,
    ErrorMessage,
    Text,
} from "@vector-im/compound-web";
import CopyIcon from "@vector-im/compound-design-tokens/assets/web/icons/copy";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler.tsx";
import { EncryptionCard } from "./EncryptionCard.tsx";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo.ts";
import { copyPlaintext } from "../../../../utils/strings.ts";
import { withSecretStorageKeyCache } from "../../../../SecurityManager.ts";

/**
 * The possible states of the component.
 * - `warn_user`: The user is warned about the consequences of changing the recovery key.
 * - `save_key_setup_flow`: The user is asked to save the new recovery key during the setup flow.
 * - `save_key_change_flow`: The user is asked to save the new recovery key during the chang key flow.
 * - `confirm`: The user is asked to confirm the new recovery key.
 */
type State = "warn_user" | "save_key_setup_flow" | "save_key_change_flow" | "confirm";

interface ChangeRecoveryKeyProps {
    /**
     * If true, the component will display the flow to set up a new recovery key.
     * If false, the component will display the flow to change the recovery key.
     */
    isSetupFlow: boolean;
    /**
     * Called when the recovery key is successfully changed.
     */
    onFinish: () => void;
    /**
     * Called when the cancel button is clicked or when we go back in the breadcrumbs.
     */
    onCancelClick: () => void;
}

export function ChangeRecoveryKey({
    isSetupFlow,
    onFinish,
    onCancelClick,
}: ChangeRecoveryKeyProps): JSX.Element | null {
    console.log("ChangeRecoveryKey.tsx: ChangeRecoveryKey");
    const matrixClient = useMatrixClientContext();

    const [state, setState] = useState<State>(isSetupFlow ? "warn_user" : "save_key_change_flow");
    const labels = getLabels(state);

    const recoveryKey = useAsyncMemo(() => {
        const crypto = matrixClient.getCrypto();
        if (!crypto) return Promise.resolve(undefined);

        return crypto.createRecoveryKeyFromPassphrase();
    }, []);

    console.log(recoveryKey);

    if (!recoveryKey?.encodedPrivateKey) return null;

    console.log("ChangeRecoveryKey.tsx: ChangeRecoveryKey");

    let content: JSX.Element;
    switch (state) {
        case "warn_user":
            content = (
                <WarningPanel onContinueClick={() => setState("save_key_setup_flow")} onCancelClick={onCancelClick} />
            );
            break;
        case "save_key_setup_flow":
            content = (
                <KeyPanel
                    recoveryKey={recoveryKey?.encodedPrivateKey}
                    onConfirmClick={() => setState("confirm")}
                    onCancelClick={onCancelClick}
                />
            );
            break;
        case "save_key_change_flow":
            content = (
                <KeyPanel
                    recoveryKey={recoveryKey?.encodedPrivateKey}
                    onConfirmClick={() => setState("confirm")}
                    onCancelClick={onCancelClick}
                />
            );
            break;
        case "confirm":
            content = (
                <KeyForm
                    recoveryKey={recoveryKey.encodedPrivateKey}
                    onCancelClick={onCancelClick}
                    onSubmit={async () => {
                        const crypto = matrixClient.getCrypto();
                        if (!crypto) return onFinish();

                        try {
                            // We need to enable the cache to avoid to prompt the user to enter the new key
                            // when we will try to access the secret storage during the bootstrap
                            await withSecretStorageKeyCache(() =>
                                crypto.bootstrapSecretStorage({
                                    setupNewKeyBackup: isSetupFlow,
                                    setupNewSecretStorage: true,
                                    createSecretStorageKey: async () => recoveryKey,
                                }),
                            );
                            onFinish();
                        } catch (e) {
                            logger.error("Failed to bootstrap secret storage", e);
                        }
                    }}
                />
            );
    }

    const pages = [
        _t("settings|encryption|title"),
        isSetupFlow
            ? _t("settings|encryption|recovery|set_up_recovery")
            : _t("settings|encryption|recovery|change_recovery_key"),
    ];

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onCancelClick}
                pages={pages}
                onPageClick={onCancelClick}
            />
            <EncryptionCard title={labels.title} description={labels.description} className="mx_ChangeRecoveryKey">
                {content}
            </EncryptionCard>
        </>
    );
}

type Labels = {
    title: string;
    description: string;
};

function getLabels(state: State): Labels {
    switch (state) {
        case "warn_user":
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
        case "confirm":
            return {
                title: _t("settings|encryption|recovery|confirm_title"),
                description: _t("settings|encryption|recovery|confirm_description"),
            };
    }
}

interface WarningPanelProps {
    /**
     * Called when the continue button is clicked.
     */
    onContinueClick: MouseEventHandler<HTMLButtonElement>;
    /**
     * Called when the cancel button is clicked.
     */
    onCancelClick: MouseEventHandler<HTMLButtonElement>;
}

function WarningPanel({ onContinueClick, onCancelClick }: WarningPanelProps): JSX.Element {
    return (
        <>
            <Text as="span" weight="medium" className="mx_WarningPanel_description">
                {_t("settings|encryption|recovery|set_up_recovery_secondary_description")}
            </Text>
            <div className="mx_ChangeRecoveryKey_footer">
                <Button onClick={onContinueClick}>{_t("action|continue")}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </div>
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
                    <Text as="span" className="mx_KeyPanel_key">
                        {recoveryKey}
                    </Text>
                    <Text as="span" size="sm">
                        {_t("settings|encryption|recovery|save_key_description")}
                    </Text>
                </div>
                <IconButton size="28px" onClick={() => copyPlaintext(recoveryKey)}>
                    <CopyIcon />
                </IconButton>
            </div>
            <div className="mx_ChangeRecoveryKey_footer">
                <Button onClick={onConfirmClick}>{_t("action|continue")}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </div>
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
}

function KeyForm({ onCancelClick, onSubmit, recoveryKey }: KeyFormProps): JSX.Element {
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
                <Label>{_t("settings|encryption|recovery|enter_key_title")}</Label>

                <TextControl required={true} />
                {isKeyInvalidAndFilled && (
                    <ErrorMessage>{_t("settings|encryption|recovery|enter_key_error")}</ErrorMessage>
                )}
            </Field>
            <div className="mx_ChangeRecoveryKey_footer">
                <Button disabled={!isKeyValid}>{_t("settings|encryption|recovery|confirm_finish")}</Button>
                <Button kind="tertiary" onClick={onCancelClick}>
                    {_t("action|cancel")}
                </Button>
            </div>
        </Root>
    );
}
