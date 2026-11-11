/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    AgentContactInstructions,
    AgentModel,
    AgentProvider,
    AgentReplyMarking,
    AgentReplyRequest,
    AgentResult,
    AgentSettings,
    AgentStatus,
    AgentSuggestionsRequest,
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
    /** Forget the credential of a provider */
    disconnect(provider: AgentProvider): Promise<AgentResult<void>>;
    /** List the models a connected provider offers */
    listModels(provider: AgentProvider): Promise<AgentResult<AgentModel[]>>;
    /** Get the rooms the agent replies in, for a Matrix user */
    getRooms(userId: string): Promise<AgentResult<string[]>>;
    /**
     * Mark a room for the agent to reply in, or unmark it. The marks are kept by the platform, on this computer only.
     * @returns the rooms the agent replies in afterwards
     */
    setRoom(userId: string, roomId: string, enabled: boolean): Promise<AgentResult<string[]>>;
    /**
     * Get how the agent's replies are marked in the rooms of a Matrix user, kept by the platform on this computer.
     * @returns the marking of each room that doesn't use the default, `notice`
     */
    getReplyMarkings(userId: string): Promise<AgentResult<Record<string, AgentReplyMarking>>>;
    /**
     * Set how the agent's replies are marked in a room.
     * @returns the marking of each room that doesn't use the default afterwards
     */
    setReplyMarking(
        userId: string,
        roomId: string,
        marking: AgentReplyMarking,
    ): Promise<AgentResult<Record<string, AgentReplyMarking>>>;
    /** Get the instructions for a chat partner, kept by the platform in a Markdown file of their own */
    getContactInstructions(contactId: string): Promise<AgentResult<AgentContactInstructions>>;
    /** Save the instructions for a chat partner; empty instructions delete the file */
    setContactInstructions(contactId: string, text: string): Promise<AgentResult<AgentContactInstructions>>;
    /**
     * Open the Markdown file with the instructions for a chat partner in the app the system uses for it, creating
     * the file if it is missing.
     * @returns the instructions as they are when the file is opened
     */
    openContactInstructions(contactId: string): Promise<AgentResult<AgentContactInstructions>>;
    /** Write the next message of the user in a direct message */
    generateReply(request: AgentReplyRequest): Promise<AgentResult<string>>;
    /** Suggest replies the user could send next in a chat */
    generateSuggestions(request: AgentSuggestionsRequest): Promise<AgentResult<string[]>>;
}
