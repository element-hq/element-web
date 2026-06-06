/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, RadioInput, TextInput, PasswordInput, Separator, Text } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import { _t } from "../../utils/i18n";
import styles from "./NetworkProxyView.module.css";

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
        <div className={styles.networkProxyView}>
            <div className={styles.modeSection}>
                <Text weight="semibold">{_t("settings|network_proxy|connection_mode")}</Text>

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

                {mode === "custom" && (
                    <div className={styles.configSection}>
                        <Separator />
                        <Text weight="semibold">{_t("common|configuration")}</Text>

                        <div className={styles.field}>
                            <Text as="label" weight="medium" size="sm">
                                {_t("common|protocol")}
                            </Text>
                            <select
                                value={scheme}
                                onChange={(e) => vm.updateScheme(e.target.value)}
                                className={styles.select}
                            >
                                <option value="http">{_t("settings|network_proxy|protocol_http")}</option>
                                <option value="https">{_t("settings|network_proxy|protocol_https")}</option>
                                <option value="socks5">{_t("settings|network_proxy|protocol_socks5")}</option>
                            </select>
                        </div>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_host">
                                    {_t("settings|network_proxy|proxy_host")}
                                </Text>
                                <TextInput
                                    id="mx_NetworkProxyView_host"
                                    value={host}
                                    onChange={(e) => vm.updateHost(e.target.value)}
                                    className="mx_NetworkProxyModal_hostInput"
                                />
                            </div>
                            <div className={styles.portField}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_port">
                                    {_t("settings|network_proxy|port")}
                                </Text>
                                <TextInput
                                    id="mx_NetworkProxyView_port"
                                    type="number"
                                    value={port}
                                    onChange={(e) => vm.updatePort(e.target.value)}
                                    min={1}
                                    max={65535}
                                    step={1}
                                    className="mx_NetworkProxyModal_portInput"
                                />
                            </div>
                        </div>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_username">
                                    {_t("common|username")}
                                </Text>
                                <TextInput
                                    id="mx_NetworkProxyView_username"
                                    value={username}
                                    onChange={(e) => vm.updateUsername(e.target.value)}
                                    className="mx_NetworkProxyModal_usernameInput"
                                />
                            </div>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_password">
                                    {_t("common|password")}
                                </Text>
                                <PasswordInput
                                    id="mx_NetworkProxyView_password"
                                    value={password}
                                    onChange={(e) => vm.updatePassword(e.target.value)}
                                    className="mx_NetworkProxyModal_passwordInput"
                                />
                            </div>
                        </div>

                        <Text size="sm" className={styles.helperText}>
                            {_t("settings|network_proxy|proxy_config_encrypted_system_storage")}
                        </Text>

                        <div className={styles.field}>
                            <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_bypass">
                                {_t(
                                    "settings|network_proxy|no_proxy_for_comma_separated",
                                    {},
                                    {
                                        Input: () => (
                                            <TextInput
                                                id="mx_NetworkProxyView_bypass"
                                                value={bypass}
                                                onChange={(e) => vm.updateBypass(e.target.value)}
                                                className="mx_NetworkProxyModal_bypassInput"
                                            />
                                        ),
                                    },
                                )}
                            </Text>
                        </div>

                        <Text size="sm" className={styles.helperText}>
                            {_t("settings|network_proxy|proxy_settings_updates_warning")}
                        </Text>
                    </div>
                )}

                {error && (
                    <Text size="sm" className={styles.errorText}>
                        {error}
                    </Text>
                )}
            </div>

            <div className={styles.footer}>
                <Button kind="secondary" onClick={vm.cancel}>
                    {_t("action|cancel")}
                </Button>
                <Button kind="primary" onClick={vm.save} disabled={!hasChanges || !isValid || loading}>
                    {_t("action|save")}
                </Button>
            </div>
        </div>
    );
}
