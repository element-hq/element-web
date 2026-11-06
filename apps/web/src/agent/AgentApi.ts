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
} from "shared-types";

/**
 * Access to the agent that replies to the direct messages the user marked for it. The platform holds the
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
    /** Write the next message of the user in a direct message */
    generateReply(request: AgentReplyRequest): Promise<AgentResult<string>>;
}
