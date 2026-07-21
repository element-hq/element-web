/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, RadioInput, Separator, Text, Dropdown, Heading, Form } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { _t } from "../../core/i18n/i18n";
import styles from "./NetworkProxyView.module.css";

/**
 * Maps a proxy protocol to its translated display label.
 */
function protocolLabel(protocol: string): string {
    switch (protocol) {
        case "http":
            return _t("settings|network_proxy|protocol_http");
        case "https":
            return _t("settings|network_proxy|protocol_https");
        case "socks5":
            return _t("settings|network_proxy|protocol_socks5");
        default:
            return protocol;
    }
}


/**
 * The snapshot representing the current state of the NetworkProxy configuration.
 */
export interface NetworkProxyViewSnapshot {
    /** The configured proxy mode. */
    mode: "system" | "direct" | "custom";
    /** The protocol scheme for custom proxy. */
    scheme: string;
    /** The host for custom proxy. */
    host: string;
    /** The port for custom proxy. */
    port: string;
    /** The username for proxy authentication. */
    username: string;
    /** The password for proxy authentication. */
    password: string;
    /** A comma-separated list of hosts to bypass the proxy. */
    bypass: string;
    /** Whether there are unsaved changes. */
    hasChanges: boolean;
    /** Whether the current configuration is valid and can be saved. */
    isValid: boolean;
    /** Whether a save operation is currently in progress. */
    loading: boolean;
    /** An error message if saving failed, otherwise null. */
    error: string | null;
}

/**
 * Actions that can be performed on the NetworkProxyView.
 */
export interface NetworkProxyViewActions {
    /** Updates the proxy mode. */
    updateMode: (mode: "system" | "direct" | "custom") => void;
    /** Updates the proxy scheme. */
    updateScheme: (scheme: string) => void;
    /** Updates the proxy host. */
    updateHost: (host: string) => void;
    /** Updates the proxy port. */
    updatePort: (port: string) => void;
    /** Updates the proxy username. */
    updateUsername: (username: string) => void;
    /** Updates the proxy password. */
    updatePassword: (password: string) => void;
    /** Updates the proxy bypass rules. */
    updateBypass: (bypass: string) => void;
    /** Saves the current proxy configuration. */
    save: () => Promise<void>;
    /** Cancels the proxy configuration and closes the view. */
    cancel: () => void;
}

/**
 * The view model for NetworkProxyView.
 */
export type NetworkProxyViewModel = ViewModel<NetworkProxyViewSnapshot, NetworkProxyViewActions>;

interface NetworkProxyViewProps {
    /**
     * The view model for the network proxy settings.
     */
    vm: NetworkProxyViewModel;
}

/**
 * A component to configure network proxy settings.
 *
 * @example
 * ```tsx
 * <NetworkProxyView vm={networkProxyViewModel} />
 * ```
 */
export function NetworkProxyView({ vm }: Readonly<NetworkProxyViewProps>): JSX.Element {
    const { mode, scheme, host, port, username, password, bypass, hasChanges, isValid, loading, error } =
        useViewModel(vm);

    return (
        <Form.Root
            className={styles.networkProxyView}
            onSubmit={(e) => {
                e.preventDefault();
                if (hasChanges && isValid && !loading) {
                    vm.save();
                }
            }}
        >
            <div className={styles.modeSection}>
                <Heading as="h2" size="sm" weight="semibold">
                    {_t("settings|network_proxy|connection_mode")}
                </Heading>

                <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                        <RadioInput
                            name="proxyMode"
                            value="system"
                            checked={mode === "system"}
                            onChange={() => vm.updateMode("system")}
                        />
                        <Text as="span">{_t("settings|network_proxy|use_system_proxy")}</Text>
                    </label>
                    <label className={styles.radioLabel}>
                        <RadioInput
                            name="proxyMode"
                            value="direct"
                            checked={mode === "direct"}
                            onChange={() => vm.updateMode("direct")}
                        />
                        <Text as="span">{_t("settings|network_proxy|no_proxy_direct")}</Text>
                    </label>
                    <label className={styles.radioLabel}>
                        <RadioInput
                            name="proxyMode"
                            value="custom"
                            checked={mode === "custom"}
                            onChange={() => vm.updateMode("custom")}
                        />
                        <Text as="span">{_t("settings|network_proxy|manual_configuration")}</Text>
                    </label>
                </div>
            </div>

            {mode === "custom" && (
                <div className={styles.configSection}>
                    <Separator />
                    <Heading as="h2" size="sm" weight="semibold">
                        {_t("common|configuration")}
                    </Heading>

                    <Dropdown
                        label={_t("common|protocol")}
                        placeholder={_t("common|protocol")}
                        value={scheme}
                        onValueChange={(val) => vm.updateScheme(val)}
                        values={[
                            ["http", protocolLabel("http")],
                            ["https", protocolLabel("https")],
                            ["socks5", protocolLabel("socks5")],
                        ] as [string, string][]}
                        className={styles.input}
                    />

                    <div className={styles.fieldRow}>
                        <Form.Field name="host" className={styles.hostField}>
                            <Form.Label>{_t("settings|network_proxy|proxy_host")}</Form.Label>
                            <Form.TextControl
                                id="mx_NetworkProxyView_host"
                                value={host}
                                onChange={(e) => vm.updateHost(e.target.value)}
                            />
                        </Form.Field>
                        <Form.Field name="port" className={styles.portField}>
                            <Form.Label>{_t("settings|network_proxy|port")}</Form.Label>
                            <Form.TextControl
                                id="mx_NetworkProxyView_port"
                                type="number"
                                value={port}
                                onChange={(e) => vm.updatePort(e.target.value)}
                                min={1}
                                max={65535}
                                step={1}
                            />
                        </Form.Field>
                    </div>

                    <Form.Field name="username">
                        <Form.Label>{_t("common|username")}</Form.Label>
                        <Form.TextControl
                            id="mx_NetworkProxyView_username"
                            value={username}
                            onChange={(e) => vm.updateUsername(e.target.value)}
                        />
                    </Form.Field>

                    <Form.Field name="password">
                        <Form.Label>{_t("common|password")}</Form.Label>
                        <Form.PasswordControl
                            id="mx_NetworkProxyView_password"
                            value={password}
                            onChange={(e) => vm.updatePassword(e.target.value)}
                        />
                        <Form.HelpMessage>
                            {_t("settings|network_proxy|proxy_config_encrypted_system_storage")}
                        </Form.HelpMessage>
                    </Form.Field>

                    <Form.Field name="bypass">
                        <Form.Label>{_t("settings|network_proxy|no_proxy_for")}</Form.Label>
                        <Form.TextControl
                            id="mx_NetworkProxyView_bypass"
                            value={bypass}
                            onChange={(e) => vm.updateBypass(e.target.value)}
                        />
                        <Form.HelpMessage>
                            {_t("settings|network_proxy|proxy_settings_updates_warning")}
                        </Form.HelpMessage>
                    </Form.Field>

                    {error && (
                        <Form.ErrorMessage>
                            {error}
                        </Form.ErrorMessage>
                    )}
                </div>
            )}

            <div className={styles.footer}>
                <Button kind="secondary" type="button" onClick={vm.cancel}>
                    {_t("action|cancel")}
                </Button>
                <Button kind="primary" type="submit" disabled={!hasChanges || !isValid || loading}>
                    {_t("action|save")}
                </Button>
            </div>
        </Form.Root>
    );
}
