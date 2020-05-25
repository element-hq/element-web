/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import type {ICompletion, ISelectionRange} from './Autocompleter';

export interface ICommand {
    command: string | null;
    range: {
        start: number;
        end: number;
    };
}

export default class AutocompleteProvider {
    commandRegex: RegExp;
    forcedCommandRegex: RegExp;

    constructor(commandRegex?: RegExp, forcedCommandRegex?: RegExp) {
        if (commandRegex) {
            if (!commandRegex.global) {
                throw new Error('commandRegex must have global flag set');
            }
            this.commandRegex = commandRegex;
        }
        if (forcedCommandRegex) {
            if (!forcedCommandRegex.global) {
                throw new Error('forcedCommandRegex must have global flag set');
            }
            this.forcedCommandRegex = forcedCommandRegex;
        }
    }

    destroy() {
        // stub
    }

    /**
     * Of the matched commands in the query, returns the first that contains or is contained by the selection, or null.
     * @param {string} query The query string
     * @param {ISelectionRange} selection Selection to search
     * @param {boolean} force True if the user is forcing completion
     * @return {object} { command, range } where both objects fields are null if no match
     */
    getCurrentCommand(query: string, selection: ISelectionRange, force = false) {
        let commandRegex = this.commandRegex;

        if (force && this.shouldForceComplete()) {
            commandRegex = this.forcedCommandRegex || /\S+/g;
        }

        if (!commandRegex) {
            return null;
        }

        commandRegex.lastIndex = 0;

        let match;
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

    async getCompletions(query: string, selection: ISelectionRange, force = false): Promise<ICompletion[]> {
        return [];
    }

    getName(): string {
        return 'Default Provider';
    }

    renderCompletions(completions: React.ReactNode[]): React.ReactNode | null {
        console.error('stub; should be implemented in subclasses');
        return null;
    }

    // Whether we should provide completions even if triggered forcefully, without a sigil.
    shouldForceComplete(): boolean {
        return false;
    }
}
