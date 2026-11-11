/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useState } from "react";
import {
    Button,
    ErrorMessage,
    Field,
    HelpMessage,
    InlineField,
    Label,
    PasswordControl,
    RadioControl,
    Root,
    Submit,
    Text,
    ToggleControl,
} from "@vector-im/compound-web";

import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";
import { Flex } from "../../core/utils/Flex";
import styles from "./AgentSettingsView.module.css";

/**
 * The AI providers the agent can use: Claude with an Anthropic API key, or GitHub Copilot with a GitHub account.
 */
export type AgentSettingsProvider = "claude" | "copilot";

/**
 * How Copilot is connected.
 * - `account`: with the GitHub account Copilot is signed in to on this computer.
 * - `token`: with a GitHub token.
 */
export type AgentSettingsCopilotAuth = "account" | "token";

/**
 * The GitHub account Copilot is signed in to on this computer.
 */
export interface AgentSettingsCopilotAccount {
    /** Whether Copilot is signed in to an account on this computer */
    signedIn: boolean;
    /** The GitHub login of the account, if known */
    login?: string;
}

/**
 * Why the last action failed.
 * - `invalid_credential`: the provider rejected the key or token.
 * - `rate_limited`: the provider asks to slow down, or the plan's allowance is used up.
 * - `unavailable`: the provider could not be reached.
 * - `unknown`: anything else.
 */
export type AgentSettingsError = "invalid_credential" | "rate_limited" | "unavailable" | "unknown";

/**
 * A model the selected provider offers.
 */
export interface AgentSettingsModel {
    id: string;
    /** Name for display */
    name: string;
}

export interface AgentSettingsViewSnapshot {
    /** Whether the settings are still being read */
    isLoading: boolean;
    /** Whether an action is in progress, during which the controls are disabled */
    isBusy: boolean;
    /** The provider that writes the replies */
    provider: AgentSettingsProvider;
    /** Whether each provider is connected */
    connected: Record<AgentSettingsProvider, boolean>;
    /** How Copilot is connected, if it is */
    copilotAuth?: AgentSettingsCopilotAuth;
    /** The GitHub account Copilot is signed in to on this computer, once it is known */
    copilotAccount?: AgentSettingsCopilotAccount;
    /** Whether the user is signing in to GitHub in the browser */
    isSigningIn: boolean;
    /** The models of the selected provider; empty while it is not connected */
    models: AgentSettingsModel[];
    /** The selected model, or undefined for the provider's default */
    model?: string;
    /** The user's own instructions for the agent */
    instructions: string;
    /** Whether replies are suggested above the composer of every chat */
    replySuggestions: boolean;
    /** Why the last action failed, if it did */
    error?: AgentSettingsError;
}

export interface AgentSettingsViewActions {
    /** Choose the provider that writes the replies */
    setProvider: (provider: AgentSettingsProvider) => void;
    /** Connect the selected provider with an API key or token */
    connect: (credential: string) => void;
    /** Connect Copilot with the GitHub account it is signed in to on this computer */
    connectCopilotAccount: () => void;
    /** Sign in to GitHub in the browser and connect Copilot with that account */
    signInCopilot: () => void;
    /** Stop signing in to GitHub */
    cancelCopilotSignIn: () => void;
    /** Disconnect the selected provider */
    disconnect: () => void;
    /** Choose a model of the selected provider, or "" for its default */
    setModel: (model: string) => void;
    /** Save the user's own instructions */
    saveInstructions: (instructions: string) => void;
    /** Turn the reply suggestions on or off */
    setReplySuggestions: (enabled: boolean) => void;
}

/**
 * The view model of {@link AgentSettingsView}.
 */
export type AgentSettingsViewModel = ViewModel<AgentSettingsViewSnapshot, AgentSettingsViewActions>;

export interface AgentSettingsViewProps {
    /** The view model of the agent settings */
    vm: AgentSettingsViewModel;
}

/**
 * Settings of the agent that replies to the direct messages set to "Agent": which AI provider it uses, how the
 * provider is connected, the model, the user's own instructions and whether it suggests replies in every chat.
 * Copilot can be connected with the GitHub account it is signed in to on this computer, by signing in in the
 * browser, or with a GitHub token.
 */
export function AgentSettingsView({ vm }: Readonly<AgentSettingsViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        isLoading,
        isBusy,
        isSigningIn,
        provider,
        connected,
        copilotAuth,
        copilotAccount,
        models,
        model,
        instructions,
        replySuggestions,
        error,
    } = useViewModel(vm);
    const [credential, setCredential] = useState("");
    const [instructionsDraft, setInstructionsDraft] = useState(instructions);

    // Show the saved instructions once they are loaded
    useEffect(() => setInstructionsDraft(instructions), [instructions]);
    // A credential typed for one provider is never sent to the other
    useEffect(() => setCredential(""), [provider]);

    if (isLoading) return <Text>{_t("common|loading")}</Text>;

    const isConnected = connected[provider];
    // The keys are written out so that the translation tooling finds them
    const providerNames: Record<AgentSettingsProvider, string> = {
        claude: _t("settings|agent|provider_claude"),
        copilot: _t("settings|agent|provider_copilot"),
    };
    const connectedLabels: Record<AgentSettingsProvider, string> = {
        claude: _t("settings|agent|connected_claude"),
        copilot: _t("settings|agent|connected_copilot"),
    };
    const credentialLabels: Record<AgentSettingsProvider, string> = {
        claude: _t("settings|agent|credential_claude"),
        copilot: _t("settings|agent|credential_copilot"),
    };
    const credentialHelp: Record<AgentSettingsProvider, string> = {
        claude: _t("settings|agent|credential_help_claude"),
        copilot: _t("settings|agent|credential_help_copilot"),
    };
    const errorMessages: Record<AgentSettingsError, string> = {
        invalid_credential: _t("settings|agent|error_invalid_credential"),
        rate_limited: _t("settings|agent|error_rate_limited"),
        unavailable: _t("settings|agent|error_unavailable"),
        unknown: _t("settings|agent|error_unknown"),
    };
    const errorMessage = error && errorMessages[error];
    const connectedLabel =
        provider === "copilot" && copilotAuth === "account" && copilotAccount?.login
            ? _t("settings|agent|connected_copilot_account", { login: copilotAccount.login })
            : connectedLabels[provider];

    const tokenForm = (
        <Root
            onSubmit={(ev) => {
                ev.preventDefault();
                if (credential.trim()) vm.connect(credential.trim());
            }}
        >
            <Field name="credential">
                <Label>{credentialLabels[provider]}</Label>
                <PasswordControl
                    value={credential}
                    disabled={isBusy}
                    autoComplete="off"
                    onChange={(ev) => setCredential(ev.currentTarget.value)}
                />
                <HelpMessage>{credentialHelp[provider]}</HelpMessage>
                {provider === "claude" && errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
            </Field>
            <Submit size="md" disabled={isBusy || !credential.trim()}>
                {_t("settings|agent|connect")}
            </Submit>
        </Root>
    );

    let copilotAccountControls: JSX.Element;
    if (isSigningIn) {
        copilotAccountControls = (
            <Flex align="center" justify="space-between" gap="var(--cpd-space-4x)">
                <Text size="md">{_t("settings|agent|copilot_signing_in")}</Text>
                <Button kind="secondary" size="md" onClick={vm.cancelCopilotSignIn}>
                    {_t("action|cancel")}
                </Button>
            </Flex>
        );
    } else if (copilotAccount?.signedIn) {
        copilotAccountControls = (
            <Flex align="center" justify="space-between" gap="var(--cpd-space-4x)">
                <Text size="md">
                    {copilotAccount.login
                        ? _t("settings|agent|copilot_signed_in_as", { login: copilotAccount.login })
                        : _t("settings|agent|copilot_signed_in")}
                </Text>
                <Button kind="primary" size="md" disabled={isBusy} onClick={vm.connectCopilotAccount}>
                    {_t("settings|agent|copilot_use_account")}
                </Button>
            </Flex>
        );
    } else {
        copilotAccountControls = (
            <Flex align="center" justify="space-between" gap="var(--cpd-space-4x)">
                <Text size="md">{_t("settings|agent|copilot_sign_in_description")}</Text>
                <Button kind="primary" size="md" disabled={isBusy} onClick={vm.signInCopilot}>
                    {_t("settings|agent|copilot_sign_in")}
                </Button>
            </Flex>
        );
    }

    return (
        <Flex direction="column" gap="var(--cpd-space-6x)" className={styles.agentSettings}>
            <Text size="sm" className={styles.description}>
                {_t("settings|agent|description")}
            </Text>

            <Root onSubmit={(ev) => ev.preventDefault()}>
                <Text as="h3" size="md" weight="semibold">
                    {_t("settings|agent|provider")}
                </Text>
                {(["claude", "copilot"] as const).map((option) => (
                    <InlineField
                        key={option}
                        name="provider"
                        control={
                            <RadioControl
                                value={option}
                                checked={provider === option}
                                disabled={isBusy}
                                onChange={() => vm.setProvider(option)}
                            />
                        }
                    >
                        <Label>{providerNames[option]}</Label>
                    </InlineField>
                ))}
            </Root>

            {isConnected && (
                <Flex align="center" justify="space-between" gap="var(--cpd-space-4x)">
                    <Text size="md">{connectedLabel}</Text>
                    <Button kind="secondary" size="md" disabled={isBusy} onClick={vm.disconnect}>
                        {_t("settings|agent|disconnect")}
                    </Button>
                </Flex>
            )}

            {!isConnected && provider === "claude" && tokenForm}

            {!isConnected && provider === "copilot" && (
                <Flex direction="column" gap="var(--cpd-space-6x)">
                    <Flex direction="column" gap="var(--cpd-space-3x)">
                        <Text as="h3" size="md" weight="semibold">
                            {_t("settings|agent|copilot_account")}
                        </Text>
                        {copilotAccountControls}
                        <Text size="sm" className={styles.description}>
                            {_t("settings|agent|copilot_account_help")}
                        </Text>
                    </Flex>
                    <Flex direction="column" gap="var(--cpd-space-3x)">
                        <Text as="h3" size="md" weight="semibold">
                            {_t("settings|agent|copilot_token")}
                        </Text>
                        {tokenForm}
                    </Flex>
                    {/* Shown once below both ways of connecting, since it can come from either */}
                    {errorMessage && (
                        <Text size="sm" className={styles.error}>
                            {errorMessage}
                        </Text>
                    )}
                </Flex>
            )}

            {isConnected && (
                <Flex direction="column" gap="var(--cpd-space-2x)">
                    <label className={styles.label} htmlFor="mx_AgentSettings_model">
                        {_t("settings|agent|model")}
                    </label>
                    <select
                        id="mx_AgentSettings_model"
                        className={styles.control}
                        value={model ?? ""}
                        disabled={isBusy}
                        onChange={(ev) => vm.setModel(ev.currentTarget.value)}
                    >
                        <option value="">{_t("settings|agent|model_default")}</option>
                        {models.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                    {errorMessage && (
                        <Text size="sm" className={styles.error}>
                            {errorMessage}
                        </Text>
                    )}
                </Flex>
            )}

            <Root onSubmit={(ev) => ev.preventDefault()}>
                <InlineField
                    name="replySuggestions"
                    control={
                        <ToggleControl
                            checked={replySuggestions}
                            disabled={isBusy}
                            onChange={(ev) => vm.setReplySuggestions(ev.currentTarget.checked)}
                        />
                    }
                >
                    <Label>{_t("settings|agent|reply_suggestions")}</Label>
                    <HelpMessage>{_t("settings|agent|reply_suggestions_description")}</HelpMessage>
                </InlineField>
            </Root>

            <Flex direction="column" gap="var(--cpd-space-2x)">
                <label className={styles.label} htmlFor="mx_AgentSettings_instructions">
                    {_t("settings|agent|instructions")}
                </label>
                <textarea
                    id="mx_AgentSettings_instructions"
                    className={styles.control}
                    rows={5}
                    value={instructionsDraft}
                    disabled={isBusy}
                    placeholder={_t("settings|agent|instructions_placeholder")}
                    onChange={(ev) => setInstructionsDraft(ev.currentTarget.value)}
                />
                <Flex justify="end">
                    <Button
                        kind="primary"
                        size="md"
                        disabled={isBusy || instructionsDraft === instructions}
                        onClick={() => vm.saveInstructions(instructionsDraft)}
                    >
                        {_t("action|save")}
                    </Button>
                </Flex>
            </Flex>
        </Flex>
    );
}
