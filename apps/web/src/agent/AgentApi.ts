/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    AgentModel,
    AgentProvider,
    AgentReplyRequest,
    AgentResult,
    AgentSettings,
    AgentStatus,
    AgentSuggestionsRequest,
    CopilotAccount,
} from "shared-types";

/**
 * Access to the agent that replies to the direct messages the user marked for it, and suggests replies in any chat. The platform holds the
 * credentials and the marks and talks to the AI providers; see {@link BasePlatform.agent}.
 */
export interface AgentApi {
    /** Get the settings of the agent and which providers are connected */
    getStatus(): Promise<AgentStatus>;
    /** Change some of the settings */
    setSettings(changes: Partial<AgentSettings>): Promise<AgentResult<AgentSettings>>;
    /** Check a credential with its provider and store it */
    connect(provider: AgentProvider, credential: string): Promise<AgentResult<void>>;
    /** Forget the credential of a provider, or stop using the account of the computer for Copilot */
    disconnect(provider: AgentProvider): Promise<AgentResult<void>>;
    /** Get the GitHub account Copilot is signed in to on this computer */
    getCopilotAccount(): Promise<AgentResult<CopilotAccount>>;
    /** Connect Copilot with the GitHub account it is signed in to on this computer */
    connectCopilotAccount(): Promise<AgentResult<void>>;
    /**
     * Sign in to GitHub in the browser for Copilot on this computer, and connect Copilot with that account.
     * @returns the account that was signed in
     */
    signInCopilot(): Promise<AgentResult<CopilotAccount>>;
    /** Stop the sign-in in progress, which then fails with `cancelled` */
    cancelCopilotSignIn(): Promise<AgentResult<void>>;
    /** List the models a connected provider offers */
    listModels(provider: AgentProvider): Promise<AgentResult<AgentModel[]>>;
    /** Get the rooms the agent replies in, for a Matrix user */
    getRooms(userId: string): Promise<AgentResult<string[]>>;
    /**
     * Mark a room for the agent to reply in, or unmark it. The marks are kept by the platform, on this computer only.
     * @returns the rooms the agent replies in afterwards
     */
    setRoom(userId: string, roomId: string, enabled: boolean): Promise<AgentResult<string[]>>;
    /** Write the next message of the user in a direct message */
    generateReply(request: AgentReplyRequest): Promise<AgentResult<string>>;
    /** Suggest replies the user could send next in a chat */
    generateSuggestions(request: AgentSuggestionsRequest): Promise<AgentResult<string[]>>;
}
