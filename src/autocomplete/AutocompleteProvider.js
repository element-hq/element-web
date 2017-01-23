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
