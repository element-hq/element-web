/*
Copyright 2017 Vector Creations Ltd

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
import type {Completion, SelectionRange} from './Autocompleter';

export default class AutocompleteProvider {
    constructor(commandRegex?: RegExp, fuseOpts?: any) {
        if (commandRegex) {
            if (!commandRegex.global) {
                throw new Error('commandRegex must have global flag set');
            }
            this.commandRegex = commandRegex;
        }
    }

    /**
     * Of the matched commands in the query, returns the first that contains or is contained by the selection, or null.
     */
    getCurrentCommand(query: string, selection: {start: number, end: number}, force: boolean = false): ?string {
        let commandRegex = this.commandRegex;

        if (force && this.shouldForceComplete()) {
            commandRegex = /\S+/g;
        }

        if (commandRegex == null) {
            return null;
        }

        commandRegex.lastIndex = 0;

        let match;
        while ((match = commandRegex.exec(query)) != null) {
            let matchStart = match.index,
                matchEnd = matchStart + match[0].length;
            if (selection.start <= matchEnd && selection.end >= matchStart) {
                return {
                    command: match,
                    range: {
                        start: matchStart,
                        end: matchEnd,
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

    async getCompletions(query: string, selection: SelectionRange, force: boolean = false): Array<Completion> {
        return [];
    }

    getName(): string {
        return 'Default Provider';
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        console.error('stub; should be implemented in subclasses');
        return null;
    }

    // Whether we should provide completions even if triggered forcefully, without a sigil.
    shouldForceComplete(): boolean {
        return false;
    }
}
