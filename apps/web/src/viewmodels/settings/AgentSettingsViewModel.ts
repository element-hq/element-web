/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    type AgentSettingsError,
    type AgentSettingsProvider,
    type AgentSettingsViewModel as AgentSettingsViewModelInterface,
    type AgentSettingsViewSnapshot,
} from "@element-hq/web-shared-components";
import type { AgentErrorCode, AgentResult } from "shared-types";

import type { AgentApi } from "../../agent/AgentApi";

export interface Props {
    /** The agent of the platform, which holds the settings and credentials */
    agent: AgentApi;
}

/** Turn the error of the platform into one the settings can show */
export function toSettingsError(error: AgentErrorCode): AgentSettingsError {
    switch (error) {
        case "invalid_credential":
        case "rate_limited":
        case "unavailable":
            return error;
        default:
            return "unknown";
    }
}

/**
 * View model of the agent settings: reads the settings from the platform's agent and changes them there.
 */
export class AgentSettingsViewModel
    extends BaseViewModel<AgentSettingsViewSnapshot, Props>
    implements AgentSettingsViewModelInterface
{
    public constructor(props: Props) {
        super(props, {
            isLoading: true,
            isBusy: false,
            provider: "claude",
            connected: { claude: false, copilot: false },
            models: [],
            instructions: "",
        });
        void this.load();
    }

    private async load(): Promise<void> {
        const status = await this.props.agent.getStatus();
        if (this.isDisposed) return;
        const { provider, connected, model, instructions } = status;
        this.snapshot.merge({ isLoading: false, provider, connected, model, instructions });
        await this.loadModels();
    }

    /** Read the models of the selected provider, if it is connected */
    private async loadModels(): Promise<void> {
        const { provider, connected } = this.snapshot.current;
        if (!connected[provider]) {
            this.snapshot.merge({ models: [] });
            return;
        }
        const result = await this.props.agent.listModels(provider);
        if (this.isDisposed || this.snapshot.current.provider !== provider) return;
        if (result.ok) {
            this.snapshot.merge({ models: result.data });
        } else {
            this.snapshot.merge({ models: [], error: toSettingsError(result.error) });
        }
    }

    /**
     * Run an action of the platform's agent while the controls are disabled.
     * @returns the result, or undefined if the view model was disposed meanwhile
     */
    private async run<T>(action: () => Promise<AgentResult<T>>): Promise<AgentResult<T> | undefined> {
        this.snapshot.merge({ isBusy: true, error: undefined });
        const result = await action();
        if (this.isDisposed) return undefined;
        this.snapshot.merge({ isBusy: false, error: result.ok ? undefined : toSettingsError(result.error) });
        return result;
    }

    public setProvider = (provider: AgentSettingsProvider): void => {
        void (async () => {
            const result = await this.run(() => this.props.agent.setSettings({ provider }));
            if (!result?.ok) return;
            this.snapshot.merge({ provider: result.data.provider, model: result.data.model });
            await this.loadModels();
        })();
    };

    public connect = (credential: string): void => {
        const { provider } = this.snapshot.current;
        void (async () => {
            const result = await this.run(() => this.props.agent.connect(provider, credential));
            if (!result?.ok) return;
            this.snapshot.merge({ connected: { ...this.snapshot.current.connected, [provider]: true } });
            await this.loadModels();
        })();
    };

    public disconnect = (): void => {
        const { provider } = this.snapshot.current;
        void (async () => {
            const result = await this.run(() => this.props.agent.disconnect(provider));
            if (!result?.ok) return;
            this.snapshot.merge({ connected: { ...this.snapshot.current.connected, [provider]: false }, models: [] });
        })();
    };

    public setModel = (model: string): void => {
        void (async () => {
            const result = await this.run(() => this.props.agent.setSettings({ model }));
            if (result?.ok) this.snapshot.merge({ model: result.data.model });
        })();
    };

    public saveInstructions = (instructions: string): void => {
        void (async () => {
            const result = await this.run(() => this.props.agent.setSettings({ instructions }));
            if (result?.ok) this.snapshot.merge({ instructions: result.data.instructions });
        })();
    };
}
