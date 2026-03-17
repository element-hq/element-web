/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import {
    Button,
    RadioInput,
    TextInput,
    PasswordInput,
    Separator,
    Text,
} from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import { _t } from "../../utils/I18nApi";
import styles from "./NetworkProxyView.module.css";

/**
 * The snapshot representing the current state of the NetworkProxy configuration.
 */
export interface NetworkProxyViewSnapshot {
    mode: "system" | "direct" | "custom";
    scheme: string;
    host: string;
    port: string;
    username: string;
    password: string;
    bypass: string;
    hasChanges: boolean;
    isValid: boolean;
    loading: boolean;
    error: string | null;
}

/**
 * Actions that can be performed on the NetworkProxyView.
 */
export interface NetworkProxyViewActions {
    updateMode: (mode: "system" | "direct" | "custom") => void;
    updateScheme: (scheme: string) => void;
    updateHost: (host: string) => void;
    updatePort: (port: string) => void;
    updateUsername: (username: string) => void;
    updatePassword: (password: string) => void;
    updateBypass: (bypass: string) => void;
    save: () => Promise<void>;
    cancel: () => void;
}

/**
 * The view model for NetworkProxyView.
 */
export type NetworkProxyViewModel = ViewModel<
    NetworkProxyViewSnapshot,
    NetworkProxyViewActions
>;

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
    const {
        mode,
        scheme,
        host,
        port,
        username,
        password,
        bypass,
        hasChanges,
        isValid,
        loading,
        error,
    } = useViewModel(vm);

    return (
        <div className={styles.networkProxyView}>
            <div className={styles.modeSection}>
                <Text weight="semibold">
                    {_t("settings|network_proxy|connection_mode")}
                </Text>
                
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
                            <Text as="label" weight="medium" size="sm">{_t("common|protocol")}</Text>
                            <select
                                value={scheme}
                                onChange={(e) => vm.updateScheme(e.target.value)}
                                className={styles.select}
                            >
                                <option value="http">HTTP</option>
                                <option value="https">HTTPS</option>
                                <option value="socks5">SOCKS5</option>
                            </select>
                        </div>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_host">{_t("settings|network_proxy|proxy_host")}</Text>
                                <TextInput
                                    id="mx_NetworkProxyView_host"
                                    value={host}
                                    onChange={(e) => vm.updateHost(e.target.value)}
                                />
                            </div>
                            <div className={styles.portField}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_port">{_t("settings|network_proxy|port")}</Text>
                                <TextInput
                                    id="mx_NetworkProxyView_port"
                                    type="number"
                                    value={port}
                                    onChange={(e) => vm.updatePort(e.target.value)}
                                    min={1}
                                    max={65535}
                                    step={1}
                                />
                            </div>
                        </div>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_username">{_t("common|username")}</Text>
                                <TextInput
                                    id="mx_NetworkProxyView_username"
                                    value={username}
                                    onChange={(e) => vm.updateUsername(e.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_password">{_t("common|password")}</Text>
                                <PasswordInput
                                    id="mx_NetworkProxyView_password"
                                    value={password}
                                    onChange={(e) => vm.updatePassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <Text size="sm" className={styles.helperText}>
                            {_t("settings|network_proxy|proxy_config_encrypted_system_storage")}
                        </Text>

                        <div className={styles.field}>
                            <Text as="label" weight="medium" size="sm" htmlFor="mx_NetworkProxyView_bypass">{_t("settings|network_proxy|no_proxy_for_comma_separated")}</Text>
                            <TextInput
                                id="mx_NetworkProxyView_bypass"
                                value={bypass}
                                onChange={(e) => vm.updateBypass(e.target.value)}
                            />
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
                <Button
                    kind="primary"
                    onClick={vm.save}
                    disabled={!hasChanges || !isValid || loading}
                >
                    {_t("action|save")}
                </Button>
            </div>
        </div>
    );
}
