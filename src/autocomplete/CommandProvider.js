/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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
import {_t} from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import QueryMatcher from './QueryMatcher';
import {TextualCompletion} from './Components';
import type {Completion, SelectionRange} from "./Autocompleter";
import {CommandMap} from '../SlashCommands';

const COMMANDS = Object.values(CommandMap);

const COMMAND_RE = /(^\/\w*)(?: .*)?/g;

export default class CommandProvider extends AutocompleteProvider {
    constructor() {
        super(COMMAND_RE);
        this.matcher = new QueryMatcher(COMMANDS, {
           keys: ['command', 'args', 'description'],
        });
    }

    async getCompletions(query: string, selection: SelectionRange, force?: boolean): Array<Completion> {
        const {command, range} = this.getCurrentCommand(query, selection);
        if (!command) return [];

        let matches = [];
        // check if the full match differs from the first word (i.e. returns false if the command has args)
        if (command[0] !== command[1]) {
            // The input looks like a command with arguments, perform exact match
            const name = command[1].substr(1); // strip leading `/`
            if (CommandMap[name]) {
                // some commands, namely `me` and `ddg` don't suit having the usage shown whilst typing their arguments
                if (CommandMap[name].hideCompletionAfterSpace) return [];
                matches = [CommandMap[name]];
            }
        } else {
            if (query === '/') {
                // If they have just entered `/` show everything
                matches = COMMANDS;
            } else {
                // otherwise fuzzy match against all of the fields
                matches = this.matcher.match(command[1]);
            }
        }

        return matches.map((result) => ({
            // If the command is the same as the one they entered, we don't want to discard their arguments
            completion: result.command === command[1] ? command[0] : (result.command + ' '),
            type: "command",
            component: <TextualCompletion
                title={result.command}
                subtitle={result.args}
                description={_t(result.description)} />,
            range,
        }));
    }

    getName() {
        return '*️⃣ ' + _t('Commands');
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_block">
            { completions }
        </div>;
    }
}
