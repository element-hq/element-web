/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// This file contains types for the agent IPC API: the renderer asks the main process of Element Desktop for
// replies to direct messages in agent mode. The main process holds the credentials and talks to the providers,
// so the credentials never reach the renderer.

/**
 * The AI providers an agent can use.
 * - `claude`: the Claude API, with an Anthropic API key.
 * - `copilot`: GitHub Copilot through the Copilot SDK, with a GitHub token of a Copilot subscriber.
 */
export type AgentProvider = "claude" | "copilot";

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
}

/**
 * The settings of the agent and which providers have a stored credential.
 */
export interface AgentStatus extends AgentSettings {
    /** Whether a credential is stored for each provider */
    connected: Record<AgentProvider, boolean>;
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
 * A model a provider offers.
 */
export interface AgentModel {
    id: string;
    /** Name for display */
    name: string;
}

/**
 * Why an agent IPC command failed.
 * - `not_connected`: no credential is stored for the provider.
 * - `invalid_credential`: the provider rejected the credential.
 * - `rate_limited`: the provider asks to slow down, or the plan's allowance is used up.
 * - `refused`: the model declined to write a reply.
 * - `unavailable`: the provider could not be reached or failed.
 * - `invalid_request`: the command was called with invalid arguments.
 */
export type AgentErrorCode =
    | "not_connected"
    | "invalid_credential"
    | "rate_limited"
    | "refused"
    | "unavailable"
    | "invalid_request";

/**
 * Result of an agent IPC command: the data, or why it failed with the provider's message if any.
 */
export type AgentResult<T> = { ok: true; data: T } | { ok: false; error: AgentErrorCode; message?: string };
