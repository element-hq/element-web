/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { Button, RadioInput, TextInput, PasswordInput, Separator, Text } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { _t, _td } from "../../core/i18n/i18n";
import styles from "./NetworkProxyView.module.css";

// Mark these keys for static translation extraction
_td("settings|network_proxy|protocol_http");
_td("settings|network_proxy|protocol_https");
_td("settings|network_proxy|protocol_socks5");
_td("settings|network_proxy|requires_auth");

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

    const [showAuth, setShowAuth] = useState(!!username || !!password);

    return (
        <div className={styles.networkProxyView}>
            <div className={styles.modeSection}>
                <Text weight="semibold">{_t("settings|network_proxy|connection_mode")}</Text>

                <div className={styles.segmentedControl}>
                    <label className={`${styles.segment} ${mode === "system" ? styles.selectedSegment : ""}`}>
                        <RadioInput
                            name="proxyMode"
                            value="system"
                            checked={mode === "system"}
                            onChange={() => vm.updateMode("system")}
                            className={styles.hiddenRadio}
                        />
                        <Text as="span">{_t("settings|network_proxy|use_system_proxy")}</Text>
                    </label>
                    <label className={`${styles.segment} ${mode === "direct" ? styles.selectedSegment : ""}`}>
                        <RadioInput
                            name="proxyMode"
                            value="direct"
                            checked={mode === "direct"}
                            onChange={() => vm.updateMode("direct")}
                            className={styles.hiddenRadio}
                        />
                        <Text as="span">{_t("settings|network_proxy|no_proxy_direct")}</Text>
                    </label>
                    <label className={`${styles.segment} ${mode === "custom" ? styles.selectedSegment : ""}`}>
                        <RadioInput
                            name="proxyMode"
                            value="custom"
                            checked={mode === "custom"}
                            onChange={() => vm.updateMode("custom")}
                            className={styles.hiddenRadio}
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
                            <div className={styles.segmentedControl}>
                                {["http", "https", "socks5"].map((p) => (
                                    <label
                                        key={p}
                                        className={`${styles.segment} ${scheme === p ? styles.selectedSegment : ""}`}
                                    >
                                        <RadioInput
                                            name="proxyScheme"
                                            value={p}
                                            checked={scheme === p}
                                            onChange={() => vm.updateScheme(p)}
                                            className={styles.hiddenRadio}
                                        />
                                        <Text as="span">{_t(`settings|network_proxy|protocol_${p}` as any)}</Text>
                                    </label>
                                ))}
                            </div>
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
                                    className={styles.input}
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
                                    className={styles.input}
                                />
                            </div>
                        </div>

                        <label className={styles.authToggle}>
                            <input
                                type="checkbox"
                                checked={showAuth}
                                onChange={(e) => {
                                    setShowAuth(e.target.checked);
                                    if (!e.target.checked) {
                                        vm.updateUsername("");
                                        vm.updatePassword("");
                                    }
                                }}
                                className={styles.checkbox}
                            />
                            <Text as="span" size="sm" weight="medium">
                                {_t("settings|network_proxy|requires_auth")}
                            </Text>
                        </label>

                        {showAuth && (
                            <div className={styles.authContainer}>
                                <div className={styles.fieldRow}>
                                    <div className={styles.field}>
                                        <Text
                                            as="label"
                                            weight="medium"
                                            size="sm"
                                            htmlFor="mx_NetworkProxyView_username"
                                        >
                                            {_t("common|username")}
                                        </Text>
                                        <TextInput
                                            id="mx_NetworkProxyView_username"
                                            value={username}
                                            onChange={(e) => vm.updateUsername(e.target.value)}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Text
                                            as="label"
                                            weight="medium"
                                            size="sm"
                                            htmlFor="mx_NetworkProxyView_password"
                                        >
                                            {_t("common|password")}
                                        </Text>
                                        <PasswordInput
                                            id="mx_NetworkProxyView_password"
                                            value={password}
                                            onChange={(e) => vm.updatePassword(e.target.value)}
                                            className={styles.passwordInput}
                                        />
                                    </div>
                                </div>
                                <Text size="sm" className={styles.helperText}>
                                    {_t("settings|network_proxy|proxy_config_encrypted_system_storage")}
                                </Text>
                            </div>
                        )}

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
                                                className={styles.input}
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
