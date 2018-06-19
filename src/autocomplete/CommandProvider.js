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
import { _t, _td } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import FuzzyMatcher from './FuzzyMatcher';
import {TextualCompletion} from './Components';
import type {Completion, SelectionRange} from "./Autocompleter";

// TODO merge this with the factory mechanics of SlashCommands?
// Warning: Since the description string will be translated in _t(result.description), all these strings below must be in i18n/strings/en_EN.json file
const COMMANDS = [
    {
        command: '/me',
        args: '<message>',
        description: _td('Displays action'),
    },
    {
        command: '/ban',
        args: '<user-id> [reason]',
        description: _td('Bans user with given id'),
    },
    {
        command: '/unban',
        args: '<user-id>',
        description: _td('Unbans user with given id'),
    },
    {
        command: '/op',
        args: '<user-id> [<power-level>]',
        description: _td('Define the power level of a user'),
    },
    {
        command: '/deop',
        args: '<user-id>',
        description: _td('Deops user with given id'),
    },
    {
        command: '/invite',
        args: '<user-id>',
        description: _td('Invites user with given id to current room'),
    },
    {
        command: '/join',
        args: '<room-alias>',
        description: _td('Joins room with given alias'),
    },
    {
        command: '/part',
        args: '[<room-alias>]',
        description: _td('Leave room'),
    },
    {
        command: '/topic',
        args: '<topic>',
        description: _td('Sets the room topic'),
    },
    {
        command: '/kick',
        args: '<user-id> [reason]',
        description: _td('Kicks user with given id'),
    },
    {
        command: '/nick',
        args: '<display-name>',
        description: _td('Changes your display nickname'),
    },
    {
        command: '/ddg',
        args: '<query>',
        description: _td('Searches DuckDuckGo for results'),
    },
    {
        command: '/tint',
        args: '<color1> [<color2>]',
        description: _td('Changes colour scheme of current room'),
    },
    {
        command: '/verify',
        args: '<user-id> <device-id> <device-signing-key>',
        description: _td('Verifies a user, device, and pubkey tuple'),
    },
    {
        command: '/ignore',
        args: '<user-id>',
        description: _td('Ignores a user, hiding their messages from you'),
    },
    {
        command: '/unignore',
        args: '<user-id>',
        description: _td('Stops ignoring a user, showing their messages going forward'),
    },
    {
        command: '/devtools',
        args: '',
        description: _td('Opens the Developer Tools dialog'),
    },
];

const COMMAND_RE = /(^\/\w*)(?: .*)?/g;

export default class CommandProvider extends AutocompleteProvider {
    constructor() {
        super(COMMAND_RE);
        this.matcher = new FuzzyMatcher(COMMANDS, {
           keys: ['command', 'args', 'description'],
        });
    }

    async getCompletions(query: string, selection: SelectionRange, force?: boolean): Array<Completion> {
        const {command, range} = this.getCurrentCommand(query, selection);
        if (!command) return [];

        // if the query is just `/` (and the user hit TAB or waits), show them all COMMANDS otherwise FuzzyMatch them
        const matches = query === '/' ? COMMANDS : this.matcher.match(command[1]);
        return matches.map((result) => {
            return {
                // If the command is the same as the one they entered, we don't want to discard their arguments
                completion: result.command === command[1] ? command[0] : (result.command + ' '),
                component: (<TextualCompletion
                    title={result.command}
                    subtitle={result.args}
                    description={_t(result.description)}
                />),
                range,
            };
        });
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
