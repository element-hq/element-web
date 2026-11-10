/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { AgentContactInstructionsView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { AgentContactInstructionsViewModel } from "../../../../viewmodels/right_panel/AgentContactInstructionsViewModel";
import type { AgentApi } from "../../../../agent/AgentApi";
import { Container } from "../UserInfo";

interface UserInfoAgentInstructionsProps {
    /** The Matrix ID of the chat partner */
    userId: string;
    /** The agent of the platform */
    agent: AgentApi;
}

/**
 * The instructions for the agent about a chat partner, in their user info.
 *
 * Give it a `key` of the user ID, so that it starts over for another person.
 */
export function UserInfoAgentInstructions({ userId, agent }: Readonly<UserInfoAgentInstructionsProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new AgentContactInstructionsViewModel({ userId, agent }));
    return (
        <Container>
            <AgentContactInstructionsView vm={vm} />
        </Container>
    );
}
