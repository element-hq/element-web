/*
 * Copyright 2026 tim2zg
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "../../viewmodel/BaseViewModel";
import { 
    type NetworkProxyViewModel as INetworkProxyViewModel,
    type NetworkProxyViewSnapshot,
} from "./NetworkProxyView";

export interface NetworkProxyViewModelProps {
    initialConfig: {
        mode: "system" | "direct" | "custom";
        scheme?: string;
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        bypass?: string;
    };
    onSave: (config: any) => Promise<void>;
    onCancel: () => void;
}

export class NetworkProxyViewModel 
    extends BaseViewModel<NetworkProxyViewSnapshot, NetworkProxyViewModelProps> 
    implements INetworkProxyViewModel 
{
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

    public updateMode = (mode: "system" | "direct" | "custom"): void => {
        this.update({ mode });
    };

    public updateScheme = (scheme: string): void => {
        this.update({ scheme });
    };

    public updateHost = (host: string): void => {
        this.update({ host });
    };

    public updatePort = (port: string): void => {
        this.update({ port });
    };

    public updateUsername = (username: string): void => {
        this.update({ username });
    };

    public updatePassword = (password: string): void => {
        this.update({ password });
    };

    public updateBypass = (bypass: string): void => {
        this.update({ bypass });
    };

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
            this.snapshot.merge({ error: String(e), loading: false });
        }
    };

    public cancel = (): void => {
        this.props.onCancel();
    };

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
