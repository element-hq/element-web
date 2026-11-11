/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type AgentContactInstructionsViewModel as AgentContactInstructionsViewModelInterface,
    type AgentContactInstructionsViewSnapshot,
} from "@element-hq/web-shared-components";
import type { AgentContactInstructions, AgentResult } from "shared-types";

import type { AgentApi } from "../../agent/AgentApi";

export interface AgentContactInstructionsViewModelProps {
    /** The Matrix ID of the chat partner the instructions are about */
    userId: string;
    /** The agent of the platform, which keeps the instructions */
    agent: AgentApi;
}

/**
 * The instructions for the agent about one chat partner, kept by the platform in a Markdown file of their own.
 * Since the file can be edited outside of the app, the instructions are read again whenever the window gets focus.
 */
export class AgentContactInstructionsViewModel
    extends BaseViewModel<AgentContactInstructionsViewSnapshot, AgentContactInstructionsViewModelProps>
    implements AgentContactInstructionsViewModelInterface
{
    public constructor(props: AgentContactInstructionsViewModelProps) {
        super(props, { isLoading: true, isBusy: false, instructions: "", hasError: false });
        window.addEventListener("focus", this.onWindowFocus);
        this.disposables.track(() => window.removeEventListener("focus", this.onWindowFocus));
        void this.load();
    }

    public save = async (instructions: string): Promise<void> => {
        this.snapshot.merge({ isBusy: true, hasError: false });
        const result = await this.call(() => this.props.agent.setContactInstructions(this.props.userId, instructions));
        if (this.isDisposed) return;
        this.snapshot.merge({ isBusy: false, ...this.toSnapshot(result) });
    };

    public openFile = async (): Promise<void> => {
        this.snapshot.merge({ hasError: false });
        const result = await this.call(() => this.props.agent.openContactInstructions(this.props.userId));
        if (this.isDisposed) return;
        this.snapshot.merge(this.toSnapshot(result));
    };

    private onWindowFocus = (): void => {
        // Don't replace instructions that are being saved
        if (this.getSnapshot().isBusy) return;
        void this.load();
    };

    private async load(): Promise<void> {
        const result = await this.call(() => this.props.agent.getContactInstructions(this.props.userId));
        if (this.isDisposed) return;
        this.snapshot.merge({ isLoading: false, ...this.toSnapshot(result) });
    }

    /** Call the platform, treating a thrown error like a failed result */
    private async call(
        request: () => Promise<AgentResult<AgentContactInstructions>>,
    ): Promise<AgentResult<AgentContactInstructions>> {
        try {
            return await request();
        } catch (e) {
            logger.warn("Could not access the agent instructions for a chat partner", e);
            return { ok: false, error: "unavailable" };
        }
    }

    private toSnapshot(result: AgentResult<AgentContactInstructions>): Partial<AgentContactInstructionsViewSnapshot> {
        if (!result.ok) return { hasError: true };
        return { instructions: result.data.text, filePath: result.data.path, hasError: false };
    }
}
