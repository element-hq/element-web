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

/**
 * Turn the error of the platform into one the settings can show.
 * @returns undefined for a sign-in the user cancelled, which is not an error to show
 */
export function toSettingsError(error: AgentErrorCode): AgentSettingsError | undefined {
    switch (error) {
        case "invalid_credential":
        case "rate_limited":
        case "unavailable":
            return error;
        case "cancelled":
            return undefined;
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
            isSigningIn: false,
            provider: "claude",
            connected: { claude: false, copilot: false },
            models: [],
            instructions: "",
            replySuggestions: true,
        });
        void this.load();
    }

    public override dispose(): void {
        // A sign-in waits for the browser for minutes; nobody would see how it ends once the settings are closed
        if (this.snapshot.current.isSigningIn) void this.props.agent.cancelCopilotSignIn();
        super.dispose();
    }

    private async load(): Promise<void> {
        const status = await this.props.agent.getStatus();
        if (this.isDisposed) return;
        const { provider, connected, copilotAuth, model, instructions, replySuggestions } = status;
        this.snapshot.merge({
            isLoading: false,
            provider,
            connected,
            copilotAuth,
            model,
            instructions,
            replySuggestions,
        });
        await this.loadModels();
        await this.loadCopilotAccount();
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
     * Read the GitHub account Copilot is signed in to on this computer, when Copilot is selected and could use it.
     * With a token, Copilot runs with that token only, so the account is not looked up.
     */
    private async loadCopilotAccount(): Promise<void> {
        const { provider, connected, copilotAuth } = this.snapshot.current;
        if (provider !== "copilot" || (connected.copilot && copilotAuth !== "account")) return;
        const result = await this.props.agent.getCopilotAccount();
        if (this.isDisposed) return;
        // Without the account, Copilot can still be signed in or connected with a token
        this.snapshot.merge({ copilotAccount: result.ok ? result.data : undefined });
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
            await this.loadCopilotAccount();
        })();
    };

    public connect = (credential: string): void => {
        const { provider } = this.snapshot.current;
        void (async () => {
            const result = await this.run(() => this.props.agent.connect(provider, credential));
            if (!result?.ok) return;
            this.snapshot.merge({ connected: { ...this.snapshot.current.connected, [provider]: true } });
            if (provider === "copilot") this.snapshot.merge({ copilotAuth: "token" });
            await this.loadModels();
        })();
    };

    public connectCopilotAccount = (): void => {
        void (async () => {
            const result = await this.run(() => this.props.agent.connectCopilotAccount());
            if (!result?.ok) return;
            this.snapshot.merge({
                connected: { ...this.snapshot.current.connected, copilot: true },
                copilotAuth: "account",
            });
            await this.loadModels();
        })();
    };

    public signInCopilot = (): void => {
        void (async () => {
            this.snapshot.merge({ isSigningIn: true });
            const result = await this.run(() => this.props.agent.signInCopilot());
            if (!result) return;
            this.snapshot.merge({ isSigningIn: false });
            if (!result.ok) return;
            this.snapshot.merge({
                connected: { ...this.snapshot.current.connected, copilot: true },
                copilotAuth: "account",
                copilotAccount: result.data,
            });
            await this.loadModels();
        })();
    };

    public cancelCopilotSignIn = (): void => {
        // The sign-in itself then ends with "cancelled", which resets the state
        void this.props.agent.cancelCopilotSignIn();
    };

    public disconnect = (): void => {
        const { provider } = this.snapshot.current;
        void (async () => {
            const result = await this.run(() => this.props.agent.disconnect(provider));
            if (!result?.ok) return;
            this.snapshot.merge({ connected: { ...this.snapshot.current.connected, [provider]: false }, models: [] });
            if (provider === "copilot") {
                this.snapshot.merge({ copilotAuth: undefined });
                await this.loadCopilotAccount();
            }
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

    public setReplySuggestions = (replySuggestions: boolean): void => {
        void (async () => {
            const result = await this.run(() => this.props.agent.setSettings({ replySuggestions }));
            if (result?.ok) this.snapshot.merge({ replySuggestions: result.data.replySuggestions });
        })();
    };
}
