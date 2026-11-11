/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useState } from "react";
import { Button, Text } from "@vector-im/compound-web";

import { useViewModel, type ViewModel } from "../../../core/viewmodel";
import { useI18n } from "../../../core/i18n/i18nContext";
import { Flex } from "../../../core/utils/Flex";
import styles from "./AgentContactInstructionsView.module.css";

export interface AgentContactInstructionsViewSnapshot {
    /** Whether the instructions are still being read */
    isLoading: boolean;
    /** Whether the instructions are being saved, during which the controls are disabled */
    isBusy: boolean;
    /** The saved instructions, in Markdown */
    instructions: string;
    /** Where the instructions are kept, so that they can also be edited outside of the app */
    filePath?: string;
    /** Whether the last attempt to read or save the instructions failed */
    hasError: boolean;
}

export interface AgentContactInstructionsViewActions {
    /** Save the instructions; empty instructions remove them */
    save: (instructions: string) => void;
    /** Open the file with the instructions in the app the system uses for Markdown files */
    openFile: () => void;
}

/**
 * The view model of {@link AgentContactInstructionsView}.
 */
export type AgentContactInstructionsViewModel = ViewModel<
    AgentContactInstructionsViewSnapshot,
    AgentContactInstructionsViewActions
>;

export interface AgentContactInstructionsViewProps {
    /** The view model of the instructions */
    vm: AgentContactInstructionsViewModel;
}

/**
 * The instructions for the agent about one chat partner, shown in their user info. The agent follows them, on
 * top of the general instructions, when it replies or suggests replies in the direct message with that person.
 */
export function AgentContactInstructionsView({ vm }: Readonly<AgentContactInstructionsViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { isLoading, isBusy, instructions, filePath, hasError } = useViewModel(vm);
    const [draft, setDraft] = useState(instructions);

    // Show the saved instructions once they are loaded or saved
    useEffect(() => setDraft(instructions), [instructions]);

    return (
        <Flex direction="column" gap="var(--cpd-space-2x)" className={styles.agentContactInstructions}>
            <label className={styles.label} htmlFor="mx_AgentContactInstructions_text">
                {_t("room|agent_instructions|title")}
            </label>
            <Text size="sm" className={styles.description}>
                {_t("room|agent_instructions|description")}
            </Text>
            <textarea
                id="mx_AgentContactInstructions_text"
                className={styles.control}
                rows={6}
                value={draft}
                disabled={isLoading || isBusy}
                placeholder={_t("room|agent_instructions|placeholder")}
                onChange={(ev) => setDraft(ev.currentTarget.value)}
            />
            {filePath && (
                <Text size="sm" className={styles.description}>
                    {_t("room|agent_instructions|file", { path: filePath })}
                </Text>
            )}
            {hasError && (
                <Text size="sm" className={styles.error}>
                    {_t("room|agent_instructions|error")}
                </Text>
            )}
            <Flex justify="end" gap="var(--cpd-space-2x)">
                <Button kind="secondary" size="md" disabled={isLoading || isBusy} onClick={() => vm.openFile()}>
                    {_t("room|agent_instructions|open_file")}
                </Button>
                <Button
                    kind="primary"
                    size="md"
                    disabled={isLoading || isBusy || draft === instructions}
                    onClick={() => vm.save(draft)}
                >
                    {_t("action|save")}
                </Button>
            </Flex>
        </Flex>
    );
}
