/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// This file contains types for the agent IPC API: the renderer asks the main process of Element Desktop for
// replies to direct messages in agent mode, and for reply suggestions in any chat. The main process holds the credentials and talks to the providers,
// so the credentials never reach the renderer.

/**
 * The AI providers an agent can use.
 * - `claude`: the Claude API, with an Anthropic API key.
 * - `copilot`: GitHub Copilot through the Copilot SDK, with the GitHub account of a Copilot subscriber.
 */
export type AgentProvider = "claude" | "copilot";

/**
 * How Copilot is connected.
 * - `account`: with the GitHub account Copilot is signed in to on this computer, which the Copilot CLI uses too.
 * - `token`: with a GitHub token stored by Element.
 */
export type CopilotAuth = "account" | "token";

/**
 * The GitHub account Copilot is signed in to on this computer.
 */
export interface CopilotAccount {
    /** Whether Copilot is signed in to an account on this computer */
    signedIn: boolean;
    /** The GitHub login of the account, if known */
    login?: string;
}

/**
 * The settings of the agent, kept in the local store of Element Desktop.
 */
export interface AgentSettings {
    /** The provider that writes the replies */
    provider: AgentProvider;
    /** The model to use, or undefined for the default model of the provider */
    model?: string;
    /** Extra instructions from the user, added to the system prompt */
    instructions: string;
    /** Whether replies are suggested above the composer of every chat */
    replySuggestions: boolean;
}

/**
 * The settings of the agent and which providers have a stored credential.
 */
export interface AgentStatus extends AgentSettings {
    /** Whether each provider is connected */
    connected: Record<AgentProvider, boolean>;
    /** How Copilot is connected, if it is */
    copilotAuth?: CopilotAuth;
}

/**
 * One message of the conversation the agent replies to.
 * `assistant` is a message of the user the agent writes for, `user` a message of their chat partner.
 */
export interface AgentTurn {
    role: "user" | "assistant";
    text: string;
}

/**
 * A request for the reply to a direct message.
 */
export interface AgentReplyRequest {
    /** The display name of the user the agent writes for */
    ownName: string;
    /** The display name of their chat partner */
    partnerName: string;
    /** The latest messages of the conversation, oldest first, ending with a message of the partner */
    turns: AgentTurn[];
}

/**
 * One message of a chat the agent suggests replies for.
 */
export interface AgentSuggestionMessage {
    /** The display name of the sender */
    sender: string;
    /** Whether the user the agent writes for sent it */
    own: boolean;
    text: string;
}

/**
 * A request for replies the user could send next in a chat, direct or group.
 */
export interface AgentSuggestionsRequest {
    /** The display name of the user the agent writes for */
    ownName: string;
    /** The name of the chat */
    chatName: string;
    /** Whether the chat is a direct message */
    isDirect: boolean;
    /** The latest messages of the chat, oldest first, ending with a message of someone else */
    messages: AgentSuggestionMessage[];
}

/**
 * A model a provider offers.
 */
export interface AgentModel {
    id: string;
    /** Name for display */
    name: string;
}

/**
 * Why an agent IPC command failed.
 * - `not_connected`: the provider is not connected.
 * - `invalid_credential`: the provider rejected the credential.
 * - `rate_limited`: the provider asks to slow down, or the plan's allowance is used up.
 * - `refused`: the model declined to write a reply.
 * - `disabled`: the user turned the feature off in the settings.
 * - `unavailable`: the provider could not be reached or failed.
 * - `invalid_request`: the command was called with invalid arguments.
 * - `cancelled`: the user cancelled the sign-in.
 */
export type AgentErrorCode =
    | "cancelled"
    | "not_connected"
    | "invalid_credential"
    | "rate_limited"
    | "refused"
    | "disabled"
    | "unavailable"
    | "invalid_request";

/**
 * Result of an agent IPC command: the data, or why it failed with the provider's message if any.
 */
export type AgentResult<T> = { ok: true; data: T } | { ok: false; error: AgentErrorCode; message?: string };
