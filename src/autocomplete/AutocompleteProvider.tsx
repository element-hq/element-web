/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type React from "react";
import { TimelineRenderingType } from "../contexts/RoomContext";
import type { ICompletion, ISelectionRange } from "./Autocompleter";

export interface ICommand {
    command: RegExpExecArray | null;
    range: {
        start: number;
        end: number;
    };
}

export interface IAutocompleteOptions {
    commandRegex?: RegExp;
    forcedCommandRegex?: RegExp;
    renderingType?: TimelineRenderingType;
}

export default abstract class AutocompleteProvider {
    public commandRegex?: RegExp;
    public forcedCommandRegex?: RegExp;

    protected renderingType: TimelineRenderingType = TimelineRenderingType.Room;

    protected constructor({ commandRegex, forcedCommandRegex, renderingType }: IAutocompleteOptions) {
        if (commandRegex) {
            if (!commandRegex.global) {
                throw new Error("commandRegex must have global flag set");
            }
            this.commandRegex = commandRegex;
        }
        if (forcedCommandRegex) {
            if (!forcedCommandRegex.global) {
                throw new Error("forcedCommandRegex must have global flag set");
            }
            this.forcedCommandRegex = forcedCommandRegex;
        }
        if (renderingType) {
            this.renderingType = renderingType;
        }
    }

    public destroy(): void {
        // stub
    }

    /**
     * Of the matched commands in the query, returns the first that contains or is contained by the selection, or null.
     * @param {string} query The query string
     * @param {ISelectionRange} selection Selection to search
     * @param {boolean} force True if the user is forcing completion
     * @return {object} { command, range } where both objects fields are null if no match
     */
    public getCurrentCommand(query: string, selection: ISelectionRange, force = false): Partial<ICommand> {
        let commandRegex = this.commandRegex;

        if (force && this.shouldForceComplete()) {
            commandRegex = this.forcedCommandRegex || /\S+/g;
        }

        if (!commandRegex) {
            return {};
        }

        commandRegex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = commandRegex.exec(query)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (selection.start <= end && selection.end >= start) {
                return {
                    command: match,
                    range: {
                        start,
                        end,
                    },
                };
            }
        }
        return {
            command: null,
            range: {
                start: -1,
                end: -1,
            },
        };
    }

    public abstract getCompletions(
        query: string,
        selection: ISelectionRange,
        force: boolean,
        limit: number,
    ): Promise<ICompletion[]>;

    public abstract getName(): string;

    public abstract renderCompletions(completions: React.ReactNode[]): React.ReactNode | null;

    // Whether we should provide completions even if triggered forcefully, without a sigil.
    public shouldForceComplete(): boolean {
        return false;
    }
}
