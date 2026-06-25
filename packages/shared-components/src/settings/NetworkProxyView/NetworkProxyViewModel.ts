/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "../../core/viewmodel/BaseViewModel";
import { _t } from "../../core/i18n/i18n";
import {
    type NetworkProxyViewModel as INetworkProxyViewModel,
    type NetworkProxyViewSnapshot,
} from "./NetworkProxyView";

/**
 * The configuration settings for a network proxy.
 */
export type ProxyConfig = {
    /** The connection mode: 'system', 'direct', or 'custom'. */
    mode: "system" | "direct" | "custom";
    /** The protocol scheme for custom proxy, e.g. 'http', 'https', 'socks5'. */
    scheme?: string;
    /** The proxy host name or IP address. */
    host?: string;
    /** The proxy port number. */
    port?: number;
    /** The username for proxy authentication. */
    username?: string;
    /** The password for proxy authentication. */
    password?: string;
    /** A comma-separated list of bypass hosts/IPs. */
    bypass?: string;
};

/**
 * Properties for the NetworkProxyViewModel.
 */
export interface NetworkProxyViewModelProps {
    /**
     * The initial proxy configuration to populate the view.
     */
    initialConfig: ProxyConfig;
    /**
     * Callback invoked when the user attempts to save the configuration.
     */
    onSave: (config: ProxyConfig) => Promise<void>;
    /**
     * Callback invoked when the user cancels the configuration.
     */
    onCancel: () => void;
}

/**
 * View model handling the logic and state for the network proxy settings view.
 */
export class NetworkProxyViewModel
    extends BaseViewModel<NetworkProxyViewSnapshot, NetworkProxyViewModelProps>
    implements INetworkProxyViewModel
{
    /**
     * Creates an instance of NetworkProxyViewModel.
     * @param props - The view model properties.
     */
    public constructor(props: NetworkProxyViewModelProps) {
        super(props, {
            mode: props.initialConfig.mode,
            scheme: props.initialConfig.scheme ?? "http",
            host: props.initialConfig.host ?? "",
            port: props.initialConfig.port?.toString() ?? "",
            username: props.initialConfig.username ?? "",
            password: props.initialConfig.password ?? "",
            bypass: props.initialConfig.bypass ?? "",
            hasChanges: false,
            isValid: true,
            loading: false,
            error: null,
        });
        this.validate();
    }

    /**
     * Updates the proxy mode.
     * @param mode - The proxy mode to set.
     */
    public updateMode = (mode: "system" | "direct" | "custom"): void => {
        this.update({ mode });
    };

    /**
     * Updates the proxy scheme.
     * @param scheme - The protocol scheme to set.
     */
    public updateScheme = (scheme: string): void => {
        this.update({ scheme });
    };

    /**
     * Updates the proxy host.
     * @param host - The proxy hostname or IP to set.
     */
    public updateHost = (host: string): void => {
        this.update({ host });
    };

    /**
     * Updates the proxy port.
     * @param port - The proxy port string to set.
     */
    public updatePort = (port: string): void => {
        this.update({ port });
    };

    /**
     * Updates the proxy username.
     * @param username - The proxy authentication username to set.
     */
    public updateUsername = (username: string): void => {
        this.update({ username });
    };

    /**
     * Updates the proxy password.
     * @param password - The proxy authentication password to set.
     */
    public updatePassword = (password: string): void => {
        this.update({ password });
    };

    /**
     * Updates the proxy bypass rules.
     * @param bypass - A comma-separated list of bypass hosts to set.
     */
    public updateBypass = (bypass: string): void => {
        this.update({ bypass });
    };

    /**
     * Saves the current proxy configuration.
     * @returns A promise that resolves when the save operation completes.
     */
    public save = async (): Promise<void> => {
        this.snapshot.merge({ loading: true, error: null });
        try {
            const { mode, scheme, host, port, username, password, bypass } = this.getSnapshot();
            await this.props.onSave({
                mode,
                scheme,
                host,
                port: parseInt(port, 10) || undefined,
                username,
                password,
                bypass,
            });
            this.snapshot.merge({ hasChanges: false, loading: false });
        } catch (e) {
            this.snapshot.merge({
                error: _t("settings|network_proxy|error_saving_config", { err: String(e) }),
                loading: false,
            });
        }
    };

    /**
     * Cancels the proxy configuration and closes the dialog.
     */
    public cancel = (): void => {
        this.props.onCancel();
    };

    /**
     * Updates a partial state snapshot, recalculating hasChanges and triggers validation.
     * @param patch - The partial state changes.
     */
    private update(patch: Partial<NetworkProxyViewSnapshot>): void {
        this.snapshot.merge(patch);
        const next = this.getSnapshot();

        // Calculate hasChanges
        const initial = this.props.initialConfig;
        const hasChanges =
            next.mode !== initial.mode ||
            next.scheme !== (initial.scheme ?? "http") ||
            next.host !== (initial.host ?? "") ||
            next.port !== (initial.port?.toString() ?? "") ||
            next.username !== (initial.username ?? "") ||
            next.password !== (initial.password ?? "") ||
            next.bypass !== (initial.bypass ?? "");

        this.snapshot.merge({ hasChanges });
        this.validate();
    }

    /**
     * Validates the custom proxy settings to ensure that host is set and port is within valid ranges.
     */
    private validate(): void {
        const next = this.getSnapshot();
        let isValid = true;
        if (next.mode === "custom") {
            if (!next.host || !next.port) {
                isValid = false;
            }
            const portNum = parseInt(next.port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                isValid = false;
            }
        }
        if (next.isValid !== isValid) {
            this.snapshot.merge({ isValid });
        }
    }
}
